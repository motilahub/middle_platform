import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import { initDatabase, mapApp, mapUser, pool } from './db.js'

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
app.get('/api/auth/oa/exchange', asyncRoute(async (req, res) => {
  if (!process.env.OA_VERIFY_URL) return res.status(501).json({ message: '尚未配置 OA_VERIFY_URL' })
  const response = await fetch(process.env.OA_VERIFY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: req.query.ticket }) })
  if (!response.ok) return res.status(401).json({ message: 'OA ticket 无效' })
  const identity = await response.json()
  if (!identity.userId) return res.status(401).json({ message: 'OA 未返回用户编号' })
  const result = await pool.query('SELECT * FROM users WHERE code=$1', [String(identity.userId)])
  if (!result.rowCount) return res.status(403).json({ message: '用户尚未配置门户权限' })
  req.session.user = mapUser(result.rows[0]); res.json(req.session.user)
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

app.get('/api/health', asyncRoute(async (_req,res) => { await pool.query('SELECT 1'); res.json({status:'ok'}) }))
app.use((error,_req,res,_next) => { console.error(error); if(error.code==='23505')return res.status(409).json({message:'编码已存在'}); res.status(error.status||500).json({message:error.message||'服务器错误'}) })
app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`))
