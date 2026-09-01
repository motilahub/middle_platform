import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import { initDatabase, mapApp, mapSecuritySettings, mapSystemSettings, mapUser, pool } from './db.js'
import { createSsoModule } from './platform/sso/index.js'
import { registerBusinessModules, registerProtectedPlatformModules, registerPublicPlatformModules } from './bootstrap/module-registry.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads'
const production = process.env.NODE_ENV === 'production'
const configuredSessionSecret = process.env.SESSION_SECRET
if (production && (!configuredSessionSecret || configuredSessionSecret.length < 32 || configuredSessionSecret.includes('please-change') || configuredSessionSecret.includes('replace-with'))) throw new Error('生产环境必须配置至少 32 位的 SESSION_SECRET')
const sessionSecret = configuredSessionSecret || 'development-only-session-secret-do-not-use-in-production'
const sessionCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 }
let activeSecuritySettings = { apiRateLimitPerMinute: 30, passwordMinLength: 8, passwordRequireUppercase: true, passwordRequireLowercase: true, passwordRequireSpecial: true, passwordRequireNumber: true }
const apiRateBuckets = new Map()
const securitySettingsSelect = 'api_rate_limit_per_minute,password_min_length,password_require_uppercase,password_require_lowercase,password_require_special,password_require_number,updated_at'
await fs.mkdir(path.join(uploadRoot, 'original'), { recursive: true })
await fs.mkdir(path.join(uploadRoot, 'thumbnail'), { recursive: true })
await fs.mkdir(path.join(uploadRoot, 'system'), { recursive: true })
await initDatabase()
await reloadSecuritySettings()

const PgSession = connectPgSimple(session)
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '20mb' }))
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: sessionSecret,
  resave: false, saveUninitialized: false,
  cookie: sessionCookie,
}))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
app.use('/uploads', express.static(uploadRoot, { fallthrough: false, maxAge: '7d' }))

// Versioned API paths are canonical for new clients; legacy /api paths remain
// available for existing integrations during the migration period.
app.use((req, _res, next) => {
  req.url = req.url.replace(/^\/api\/v1(?=\/|$)/, '/api')
  next()
})

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ message: '请先登录' })
const requireAdmin = (req, res, next) => req.session.user && req.session.user.role !== 'user' ? next() : res.status(403).json({ message: '没有管理权限' })
const issueCsrfToken = (req) => req.session.csrfToken ||= crypto.randomBytes(32).toString('hex')
const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left || '')
  const rightBuffer = Buffer.from(right || '')
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
const requireCsrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const providedToken = String(req.get('x-csrf-token') || '')
  const expectedToken = String(req.session.csrfToken || '')
  if (!providedToken || !expectedToken || !safeEqual(providedToken, expectedToken)) return res.status(403).json({ message: '请求安全校验失败，请刷新页面后重试', code: 'CSRF_INVALID' })
  next()
}
const regenerateSession = (req) => new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
const establishSession = async (req, res, user) => {
  await regenerateSession(req)
  req.session.user = user
  res.setHeader('X-CSRF-Token', issueCsrfToken(req))
}
const ssoModule = createSsoModule({ pool, mapUser, establishSession })

app.get('/api/auth/csrf', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ token: issueCsrfToken(req) })
})
registerPublicPlatformModules(app, { asyncRoute, rateLimiter: apiRateLimiter, ssoModule })
app.use('/api', requireCsrf)
app.use('/api', apiRateLimiter)
registerProtectedPlatformModules(app, { asyncRoute, requireAuth, requireAdmin, ssoModule })
registerBusinessModules(app, { asyncRoute, requireAuth, requireAdmin, pool })

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE code=$1', [String(req.body.code || '').trim()])
  const row = result.rows[0]
  if (!row || !await bcrypt.compare(String(req.body.password || ''), row.password_hash)) return res.status(401).json({ message: '账号或密码错误' })
  const user = mapUser(row)
  await establishSession(req, res, user)
  res.json(user)
}))
app.post('/api/auth/logout', (req, res) => req.session.destroy((error) => {
  if (error) return res.status(500).json({ message: '退出登录失败' })
  res.clearCookie('connect.sid', sessionCookie); res.status(204).end()
}))
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.session.user))

const appSelect = `SELECT a.*, COALESCE(array_agg(au.user_id) FILTER (WHERE au.user_id IS NOT NULL), '{}') user_ids
  FROM dashboard_apps a LEFT JOIN dashboard_app_users au ON au.app_id=a.id GROUP BY a.id`
app.get('/api/me/apps', requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query(`${appSelect} HAVING a.enabled=TRUE AND (COUNT(au.user_id)=0 OR $1=ANY(array_agg(au.user_id))) ORDER BY a.priority,a.id`, [req.session.user.id])
  res.json(result.rows.map(mapApp))
}))
app.get('/api/admin/apps', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query(`${appSelect} ORDER BY a.priority,a.id`); res.json(result.rows.map(mapApp))
}))

async function persistImage(dataUrl, fileName, oldApp) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return { original: dataUrl || null, thumbnail: null, filename: fileName || null }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw Object.assign(new Error('图片格式无效'), { status: 400 })
  const buffer = Buffer.from(match[2], 'base64'); if (buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('图片不能超过 10MB'), { status: 400 })
  const stem = crypto.randomUUID(); const extension = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg'
  const originalRelative = `/uploads/original/${stem}.${extension}`; const thumbnailRelative = `/uploads/thumbnail/${stem}.webp`
  await fs.writeFile(path.join(uploadRoot, originalRelative.replace('/uploads/', '')), buffer)
  await sharp(buffer).resize(320, 320, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(uploadRoot, thumbnailRelative.replace('/uploads/', '')))
  await deleteImages(oldApp)
  return { original: originalRelative, thumbnail: thumbnailRelative, filename: fileName || `icon.${extension}` }
}
async function deleteImages(row) {
  for (const value of [row?.image_original, row?.image_thumbnail]) if (value?.startsWith('/uploads/')) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {})
}
const systemSettingsSelect = 'system_title,browser_title,system_logo,title_logo,login_text,footer_record,show_workbench_header,updated_at'
const systemImagePath = (value) => typeof value === 'string' && /^\/uploads\/system\/[a-z0-9-]+\.webp$/i.test(value)
async function deleteSystemImage(value) {
  if (systemImagePath(value)) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {})
}
async function persistSystemImage(value, oldValue) {
  const image = typeof value === 'string' ? value : ''
  if (!image) { await deleteSystemImage(oldValue); return null }
  if (image === oldValue && systemImagePath(image)) return image
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw Object.assign(new Error('请上传有效的图片文件'), { status: 400 })
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('系统标识图片不能超过 2MB'), { status: 400 })
  const relative = `/uploads/system/${crypto.randomUUID()}.webp`
  await sharp(buffer).rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(uploadRoot, relative.replace('/uploads/', '')))
  await deleteSystemImage(oldValue)
  return relative
}
const settingText = (value, fallback, maxLength) => String(value ?? fallback).trim().slice(0, maxLength)
async function readSystemSettings() {
  return (await pool.query(`SELECT ${systemSettingsSelect} FROM system_settings WHERE id=1`)).rows[0]
}
async function reloadSecuritySettings() {
  const result = await pool.query(`SELECT ${securitySettingsSelect} FROM system_settings WHERE id=1`)
  if (result.rows[0]) activeSecuritySettings = mapSecuritySettings(result.rows[0])
}
function apiRateLimiter(req, res, next) {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const attempts = (apiRateBuckets.get(key) || []).filter((timestamp) => timestamp > now - 60_000)
  if (attempts.length >= activeSecuritySettings.apiRateLimitPerMinute) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((attempts[0] + 60_000 - now) / 1000)))
    return res.status(429).json({ message: '接口请求过于频繁，请稍后再试', code: 'API_RATE_LIMITED' })
  }
  attempts.push(now)
  apiRateBuckets.set(key, attempts)
  next()
}
function settingInteger(value, label, min, max) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw Object.assign(new Error(`${label}必须是 ${min}-${max} 之间的整数`), { status: 400 })
  return number
}
function settingBoolean(value, label) {
  if (typeof value !== 'boolean') throw Object.assign(new Error(`${label}必须为布尔值`), { status: 400 })
  return value
}
function parseSecuritySettings(body) {
  return {
    apiRateLimitPerMinute: settingInteger(body.apiRateLimitPerMinute, '每分钟接口请求次数', 1, 10000),
    passwordMinLength: settingInteger(body.passwordMinLength, '密码最小长度', 6, 128),
    passwordRequireUppercase: settingBoolean(body.passwordRequireUppercase, '大写字母要求'),
    passwordRequireLowercase: settingBoolean(body.passwordRequireLowercase, '小写字母要求'),
    passwordRequireSpecial: settingBoolean(body.passwordRequireSpecial, '特殊符号要求'),
    passwordRequireNumber: settingBoolean(body.passwordRequireNumber, '数字要求'),
  }
}
function validatePassword(value) {
  const password = String(value || '')
  const policy = activeSecuritySettings
  if (password.length < policy.passwordMinLength) throw Object.assign(new Error(`密码长度不能少于 ${policy.passwordMinLength} 位`), { status: 400 })
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) throw Object.assign(new Error('密码必须包含大写字母'), { status: 400 })
  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) throw Object.assign(new Error('密码必须包含小写字母'), { status: 400 })
  if (policy.passwordRequireSpecial && !/[^A-Za-z0-9]/.test(password)) throw Object.assign(new Error('密码必须包含特殊符号'), { status: 400 })
  if (policy.passwordRequireNumber && !/\d/.test(password)) throw Object.assign(new Error('密码必须包含数字'), { status: 400 })
  return password
}
app.get('/api/system/settings', asyncRoute(async (_req, res) => res.json(mapSystemSettings(await readSystemSettings()))))
app.get('/api/admin/system-settings', requireAdmin, asyncRoute(async (_req, res) => res.json(mapSystemSettings(await readSystemSettings()))))
app.put('/api/admin/system-settings', requireAdmin, asyncRoute(async (req, res) => {
  const current = await readSystemSettings()
  const systemTitle = settingText(req.body.systemTitle, current.system_title, 120)
  const browserTitle = settingText(req.body.browserTitle, current.browser_title, 120)
  const loginText = settingText(req.body.loginText, current.login_text, 255)
  const footerRecord = settingText(req.body.footerRecord, current.footer_record || '', 255) || null
  const showWorkbenchHeader = typeof req.body.showWorkbenchHeader === 'boolean' ? req.body.showWorkbenchHeader : current.show_workbench_header
  if (!systemTitle || !browserTitle) return res.status(400).json({ message: '系统标题和浏览器标题不能为空' })
  const systemLogo = req.body.systemLogo === undefined ? current.system_logo : await persistSystemImage(req.body.systemLogo, current.system_logo)
  const titleLogo = req.body.titleLogo === undefined ? current.title_logo : await persistSystemImage(req.body.titleLogo, current.title_logo)
  const result = await pool.query(`UPDATE system_settings SET system_title=$1,browser_title=$2,system_logo=$3,title_logo=$4,login_text=$5,footer_record=$6,show_workbench_header=$7,updated_at=NOW() WHERE id=1 RETURNING ${systemSettingsSelect}`, [systemTitle, browserTitle, systemLogo, titleLogo, loginText, footerRecord, showWorkbenchHeader])
  res.json(mapSystemSettings(result.rows[0]))
}))
app.get('/api/admin/security-settings', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query(`SELECT ${securitySettingsSelect} FROM system_settings WHERE id=1`)
  res.json(mapSecuritySettings(result.rows[0]))
}))
app.put('/api/admin/security-settings', requireAdmin, asyncRoute(async (req, res) => {
  const next = parseSecuritySettings(req.body)
  const result = await pool.query(`UPDATE system_settings SET api_rate_limit_per_minute=$1,password_min_length=$2,password_require_uppercase=$3,password_require_lowercase=$4,password_require_special=$5,password_require_number=$6,updated_at=NOW() WHERE id=1 RETURNING ${securitySettingsSelect}`, [next.apiRateLimitPerMinute, next.passwordMinLength, next.passwordRequireUppercase, next.passwordRequireLowercase, next.passwordRequireSpecial, next.passwordRequireNumber])
  activeSecuritySettings = mapSecuritySettings(result.rows[0])
  apiRateBuckets.clear()
  res.json(activeSecuritySettings)
}))
async function saveAppUsers(client, appId, userIds) {
  await client.query('DELETE FROM dashboard_app_users WHERE app_id=$1', [appId])
  for (const userId of userIds || []) await client.query('INSERT INTO dashboard_app_users(app_id,user_id) VALUES($1,$2)', [appId, userId])
}
app.post('/api/admin/apps', requireAdmin, asyncRoute(async (req, res) => {
  const ssoConfigId = await ssoModule.service.resolveOutboundConfigId(req.body.outboundSsoConfigId)
  const image = await persistImage(req.body.img, req.body.imgFileName)
  const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query(`INSERT INTO dashboard_apps(code,name,priority,url,enabled,image_original,image_thumbnail,image_filename,outbound_sso_config_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [req.body.code,req.body.name,req.body.priority,req.body.url,req.body.enabled,image.original,image.thumbnail,image.filename,ssoConfigId]); await saveAppUsers(client,result.rows[0].id,req.body.userIds); await client.query('COMMIT'); res.status(201).json({ id: Number(result.rows[0].id) }) } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}))
app.put('/api/admin/apps/:id', requireAdmin, asyncRoute(async (req, res) => {
  const old = (await pool.query('SELECT * FROM dashboard_apps WHERE id=$1',[req.params.id])).rows[0]; if (!old) return res.status(404).json({message:'记录不存在'})
  const ssoConfigId = await ssoModule.service.resolveOutboundConfigId(req.body.outboundSsoConfigId)
  let image = { original: old.image_original, thumbnail: old.image_thumbnail, filename: old.image_filename }
  if (!req.body.img) { await deleteImages(old); image = { original:null,thumbnail:null,filename:null } }
  else if (req.body.img.startsWith('data:image/')) image = await persistImage(req.body.img,req.body.imgFileName,old)
  const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(`UPDATE dashboard_apps SET name=$1,priority=$2,url=$3,enabled=$4,image_original=$5,image_thumbnail=$6,image_filename=$7,outbound_sso_config_id=$8,updated_at=NOW() WHERE id=$9`,[req.body.name,req.body.priority,req.body.url,req.body.enabled,image.original,image.thumbnail,image.filename,ssoConfigId,req.params.id]); await saveAppUsers(client,req.params.id,req.body.userIds); await client.query('COMMIT'); res.status(204).end() } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}))
app.patch('/api/admin/apps/:id/visible', requireAdmin, asyncRoute(async (req,res) => { await pool.query('UPDATE dashboard_apps SET enabled=$1,updated_at=NOW() WHERE id=$2',[!!req.body.enabled,req.params.id]); res.status(204).end() }))
app.post('/api/admin/apps/reorder', requireAdmin, asyncRoute(async (req,res) => { const client=await pool.connect(); try { await client.query('BEGIN'); for (let i=0;i<req.body.ids.length;i++) await client.query('UPDATE dashboard_apps SET priority=$1 WHERE id=$2',[i+1,req.body.ids[i]]); await client.query('COMMIT'); res.status(204).end() } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }))
app.delete('/api/admin/apps', requireAdmin, asyncRoute(async (req,res) => { const ids=(req.body.ids||[]).map(Number); if(!ids.length)return res.status(204).end(); const old=await pool.query('SELECT * FROM dashboard_apps WHERE id=ANY($1::bigint[])',[ids]); await pool.query('DELETE FROM dashboard_apps WHERE id=ANY($1::bigint[])',[ids]); await Promise.all(old.rows.map(deleteImages)); res.status(204).end() }))
app.delete('/api/admin/apps/:id', requireAdmin, asyncRoute(async (req,res) => { const old=(await pool.query('DELETE FROM dashboard_apps WHERE id=$1 RETURNING *',[req.params.id])).rows[0]; await deleteImages(old); res.status(204).end() }))

app.get('/api/admin/users', requireAdmin, asyncRoute(async (_req,res) => { const result=await pool.query('SELECT * FROM users ORDER BY id'); res.json(result.rows.map(mapUser)) }))
app.post('/api/admin/users', requireAdmin, asyncRoute(async (req,res) => { const hash=await bcrypt.hash(validatePassword(req.body.password),12); const result=await pool.query('INSERT INTO users(uuid,code,name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *',[crypto.randomUUID(),req.body.code,req.body.name,hash,req.body.role]); res.status(201).json(mapUser(result.rows[0])) }))
app.put('/api/admin/users/:id', requireAdmin, asyncRoute(async (req,res) => { const existing=(await pool.query('SELECT * FROM users WHERE id=$1',[req.params.id])).rows[0]; if(!existing)return res.status(404).json({message:'用户不存在'}); const role=existing.code==='admin'?'super_admin':req.body.role; if(req.body.password){const hash=await bcrypt.hash(validatePassword(req.body.password),12); await pool.query('UPDATE users SET name=$1,role=$2,password_hash=$3,updated_at=NOW() WHERE id=$4',[req.body.name,role,hash,req.params.id])}else await pool.query('UPDATE users SET name=$1,role=$2,updated_at=NOW() WHERE id=$3',[req.body.name,role,req.params.id]); res.status(204).end() }))
app.delete('/api/admin/users/:id', requireAdmin, asyncRoute(async (req,res) => { const user=(await pool.query('SELECT code FROM users WHERE id=$1',[req.params.id])).rows[0]; if(user?.code==='admin')return res.status(400).json({message:'超级管理员不可删除'}); await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]); res.status(204).end() }))

app.get('/api/health', asyncRoute(async (_req,res) => { await pool.query('SELECT 1'); res.json({status:'ok'}) }))
app.use((error,_req,res,_next) => { console.error(error); if(error.code==='23505')return res.status(409).json({message:'编码已存在'}); res.status(error.status||500).json({message:error.message||'服务器错误'}) })
app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`))
