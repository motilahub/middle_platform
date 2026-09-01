import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import { initDatabase, mapApp, mapSsoConfig, mapUser, pool } from './db.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads'
await fs.mkdir(path.join(uploadRoot, 'original'), { recursive: true })
await fs.mkdir(path.join(uploadRoot, 'thumbnail'), { recursive: true })
await initDatabase()

const PgSession = connectPgSimple(session)
app.set('trust proxy', 1)
app.use(express.json({ limit: '20mb' }))
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'change-this-session-secret',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 },
}))
app.use('/uploads', express.static(uploadRoot, { fallthrough: false, maxAge: '7d' }))

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ message: '请先登录' })
const requireAdmin = (req, res, next) => req.session.user && req.session.user.role !== 'user' ? next() : res.status(403).json({ message: '没有管理权限' })

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE code=$1', [String(req.body.code || '').trim()])
  const row = result.rows[0]
  if (!row || !await bcrypt.compare(String(req.body.password || ''), row.password_hash)) return res.status(401).json({ message: '账号或密码错误' })
  req.session.user = mapUser(row)
  res.json(req.session.user)
}))
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('connect.sid'); res.status(204).end() }))
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.session.user))
const readIdentityField = (identity, fieldName) => String(fieldName || 'userId').split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, identity)
app.get('/api/auth/sso/:code/exchange', asyncRoute(async (req, res) => {
  const ticket = String(req.query.ticket || '').trim()
  if (!ticket) return res.status(400).json({ message: '缺少 ticket' })
  const config = (await pool.query(`SELECT ${ssoColumns} FROM sso_configs WHERE code=$1 AND direction='inbound' AND enabled=TRUE`, [req.params.code])).rows[0]
  if (!config) return res.status(404).json({ message: '未找到已启用的外部跳转访入配置' })
  if (config.protocol !== 'ticket') return res.status(501).json({ message: `${config.protocol.toUpperCase()} 协议暂未接入认证适配器` })
  if (!config.verify_url) return res.status(400).json({ message: '该单点登录配置未设置校验地址' })
  let response
  try {
    response = await fetch(config.verify_url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }), signal: AbortSignal.timeout(8000) })
  } catch {
    return res.status(502).json({ message: '无法连接单点登录校验服务' })
  }
  if (!response.ok) return res.status(401).json({ message: '单点登录凭证无效、已过期或已使用' })
  let identity
  try { identity = await response.json() } catch { return res.status(502).json({ message: '单点登录校验服务未返回 JSON 用户信息' }) }
  const userId = readIdentityField(identity, config.user_identifier)
  if (!userId) return res.status(401).json({ message: `单点登录校验结果未包含 ${config.user_identifier} 用户标识` })
  const result = await pool.query('SELECT * FROM users WHERE code=$1', [String(userId)])
  if (!result.rowCount) return res.status(403).json({ message: '用户尚未配置门户权限' })
  req.session.user = mapUser(result.rows[0]); res.json({ ...req.session.user, redirectUrl: config.callback_url || '/' })
}))

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
async function saveAppUsers(client, appId, userIds) {
  await client.query('DELETE FROM dashboard_app_users WHERE app_id=$1', [appId])
  for (const userId of userIds || []) await client.query('INSERT INTO dashboard_app_users(app_id,user_id) VALUES($1,$2)', [appId, userId])
}
app.post('/api/admin/apps', requireAdmin, asyncRoute(async (req, res) => {
  const image = await persistImage(req.body.img, req.body.imgFileName)
  const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query(`INSERT INTO dashboard_apps(code,name,priority,url,enabled,image_original,image_thumbnail,image_filename) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [req.body.code,req.body.name,req.body.priority,req.body.url,req.body.enabled,image.original,image.thumbnail,image.filename]); await saveAppUsers(client,result.rows[0].id,req.body.userIds); await client.query('COMMIT'); res.status(201).json({ id: Number(result.rows[0].id) }) } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}))
app.put('/api/admin/apps/:id', requireAdmin, asyncRoute(async (req, res) => {
  const old = (await pool.query('SELECT * FROM dashboard_apps WHERE id=$1',[req.params.id])).rows[0]; if (!old) return res.status(404).json({message:'记录不存在'})
  let image = { original: old.image_original, thumbnail: old.image_thumbnail, filename: old.image_filename }
  if (!req.body.img) { await deleteImages(old); image = { original:null,thumbnail:null,filename:null } }
  else if (req.body.img.startsWith('data:image/')) image = await persistImage(req.body.img,req.body.imgFileName,old)
  const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(`UPDATE dashboard_apps SET name=$1,priority=$2,url=$3,enabled=$4,image_original=$5,image_thumbnail=$6,image_filename=$7,updated_at=NOW() WHERE id=$8`,[req.body.name,req.body.priority,req.body.url,req.body.enabled,image.original,image.thumbnail,image.filename,req.params.id]); await saveAppUsers(client,req.params.id,req.body.userIds); await client.query('COMMIT'); res.status(204).end() } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}))
app.patch('/api/admin/apps/:id/visible', requireAdmin, asyncRoute(async (req,res) => { await pool.query('UPDATE dashboard_apps SET enabled=$1,updated_at=NOW() WHERE id=$2',[!!req.body.enabled,req.params.id]); res.status(204).end() }))
app.post('/api/admin/apps/reorder', requireAdmin, asyncRoute(async (req,res) => { const client=await pool.connect(); try { await client.query('BEGIN'); for (let i=0;i<req.body.ids.length;i++) await client.query('UPDATE dashboard_apps SET priority=$1 WHERE id=$2',[i+1,req.body.ids[i]]); await client.query('COMMIT'); res.status(204).end() } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }))
app.delete('/api/admin/apps', requireAdmin, asyncRoute(async (req,res) => { const ids=(req.body.ids||[]).map(Number); if(!ids.length)return res.status(204).end(); const old=await pool.query('SELECT * FROM dashboard_apps WHERE id=ANY($1::bigint[])',[ids]); await pool.query('DELETE FROM dashboard_apps WHERE id=ANY($1::bigint[])',[ids]); await Promise.all(old.rows.map(deleteImages)); res.status(204).end() }))
app.delete('/api/admin/apps/:id', requireAdmin, asyncRoute(async (req,res) => { const old=(await pool.query('DELETE FROM dashboard_apps WHERE id=$1 RETURNING *',[req.params.id])).rows[0]; await deleteImages(old); res.status(204).end() }))

app.get('/api/admin/users', requireAdmin, asyncRoute(async (_req,res) => { const result=await pool.query('SELECT * FROM users ORDER BY id'); res.json(result.rows.map(mapUser)) }))
app.post('/api/admin/users', requireAdmin, asyncRoute(async (req,res) => { const hash=await bcrypt.hash(req.body.password,12); const result=await pool.query('INSERT INTO users(uuid,code,name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *',[crypto.randomUUID(),req.body.code,req.body.name,hash,req.body.role]); res.status(201).json(mapUser(result.rows[0])) }))
app.put('/api/admin/users/:id', requireAdmin, asyncRoute(async (req,res) => { const existing=(await pool.query('SELECT * FROM users WHERE id=$1',[req.params.id])).rows[0]; if(!existing)return res.status(404).json({message:'用户不存在'}); const role=existing.code==='admin'?'super_admin':req.body.role; if(req.body.password){const hash=await bcrypt.hash(req.body.password,12); await pool.query('UPDATE users SET name=$1,role=$2,password_hash=$3,updated_at=NOW() WHERE id=$4',[req.body.name,role,hash,req.params.id])}else await pool.query('UPDATE users SET name=$1,role=$2,updated_at=NOW() WHERE id=$3',[req.body.name,role,req.params.id]); res.status(204).end() }))
app.delete('/api/admin/users/:id', requireAdmin, asyncRoute(async (req,res) => { const user=(await pool.query('SELECT code FROM users WHERE id=$1',[req.params.id])).rows[0]; if(user?.code==='admin')return res.status(400).json({message:'超级管理员不可删除'}); await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]); res.status(204).end() }))

const ssoDirections = new Set(['inbound', 'outbound'])
const ssoProtocols = new Set(['oidc', 'cas', 'ticket', 'saml'])
const requireSsoDirection = (req, res, next) => ssoDirections.has(req.params.direction) ? next() : res.status(400).json({ message: '单点登录方向无效' })
const validateSso = (body, direction) => {
  if (!body.code || !body.name || !body.systemUrl || !ssoProtocols.has(body.protocol)) throw Object.assign(new Error('请完整填写单点登录基础信息'), { status: 400 })
  if (direction === 'inbound' && body.protocol === 'ticket' && !body.verifyUrl) throw Object.assign(new Error('外部访入的 Ticket 协议必须填写校验地址'), { status: 400 })
  if (body.callbackUrl && !(/^\/(?!\/)/.test(body.callbackUrl) || /^https?:\/\//.test(body.callbackUrl))) throw Object.assign(new Error('回调地址必须是以 / 开头的系统内路径或 HTTP(S) 地址'), { status: 400 })
}
const ssoColumns = 'id,code,name,direction,protocol,system_url,verify_url,authorize_url,callback_url,issuer,client_id,user_identifier,enabled,remark,priority,created_at,updated_at'
app.get('/api/admin/sso/:direction', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT ${ssoColumns} FROM sso_configs WHERE direction=$1 ORDER BY priority,id`, [req.params.direction])
  res.json(result.rows.map(mapSsoConfig))
}))
app.post('/api/admin/sso/:direction', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  validateSso(req.body, req.params.direction)
  const result = await pool.query(`INSERT INTO sso_configs(code,name,direction,protocol,system_url,verify_url,authorize_url,callback_url,issuer,client_id,user_identifier,enabled,remark,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`, [req.body.code, req.body.name, req.params.direction, req.body.protocol, req.body.systemUrl, req.body.verifyUrl || null, req.body.authorizeUrl || null, req.body.callbackUrl || null, req.body.issuer || null, req.body.clientId || null, req.body.userIdentifier || 'userId', req.body.enabled !== false, req.body.remark || null, Number(req.body.priority) || 1])
  res.status(201).json({ id: Number(result.rows[0].id) })
}))
app.put('/api/admin/sso/:direction/:id', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  validateSso(req.body, req.params.direction)
  const result = await pool.query(`UPDATE sso_configs SET name=$1,protocol=$2,system_url=$3,verify_url=$4,authorize_url=$5,callback_url=$6,issuer=$7,client_id=$8,user_identifier=$9,enabled=$10,remark=$11,priority=$12,updated_at=NOW() WHERE id=$13 AND direction=$14`, [req.body.name, req.body.protocol, req.body.systemUrl, req.body.verifyUrl || null, req.body.authorizeUrl || null, req.body.callbackUrl || null, req.body.issuer || null, req.body.clientId || null, req.body.userIdentifier || 'userId', req.body.enabled !== false, req.body.remark || null, Number(req.body.priority) || 1, req.params.id, req.params.direction])
  if (!result.rowCount) return res.status(404).json({ message: '单点登录配置不存在' })
  res.status(204).end()
}))
app.patch('/api/admin/sso/:direction/:id/enabled', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  await pool.query('UPDATE sso_configs SET enabled=$1,updated_at=NOW() WHERE id=$2 AND direction=$3', [!!req.body.enabled, req.params.id, req.params.direction]); res.status(204).end()
}))
app.delete('/api/admin/sso/:direction', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Number.isFinite); if (!ids.length) return res.status(204).end()
  await pool.query('DELETE FROM sso_configs WHERE id=ANY($1::bigint[]) AND direction=$2', [ids, req.params.direction]); res.status(204).end()
}))
app.delete('/api/admin/sso/:direction/:id', requireAdmin, requireSsoDirection, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM sso_configs WHERE id=$1 AND direction=$2', [req.params.id, req.params.direction]); res.status(204).end()
}))

app.get('/api/health', asyncRoute(async (_req,res) => { await pool.query('SELECT 1'); res.json({status:'ok'}) }))
app.use((error,_req,res,_next) => { console.error(error); if(error.code==='23505')return res.status(409).json({message:'编码已存在'}); res.status(error.status||500).json({message:error.message||'服务器错误'}) })
app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`))
