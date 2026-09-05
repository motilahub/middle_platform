import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { initDatabase, pool } from './db.js'
import { registerBusinessModules, registerProtectedPlatformModules, registerPublicPlatformModules } from './bootstrap/module-registry.js'
import { loadBusinessModules, startModules, stopModules } from './bootstrap/module-loader.js'
import { asyncRoute, normalizeVersionedApi } from './middleware/http.js'
import { createAnyPermissionMiddleware, createPermissionMiddleware, requireAdmin, requireAuth } from './middleware/auth.js'
import { createSecurityPolicy, createSessionSecurity } from './middleware/security.js'
import { createHealthModule } from './platform/health/index.js'
import { createIdentityModule } from './platform/identity/index.js'
import { createPermissionService } from './platform/identity/permissions.js'
import { createModelProviderModule } from './platform/model-providers/index.js'
import { createSettingsModule } from './platform/settings/index.js'
import { createSsoModule } from './platform/sso/index.js'
import { createWorkbenchModule } from './platform/workbench/index.js'
import { mapApp, mapSecuritySettings, mapSystemSettings, mapUser } from './shared/mappers.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const uploadRoot = process.env.UPLOAD_DIR || '/app/uploads'
const production = process.env.NODE_ENV === 'production'
const configuredSessionSecret = process.env.SESSION_SECRET
if (production && (!configuredSessionSecret || configuredSessionSecret.length < 32 || configuredSessionSecret.includes('please-change') || configuredSessionSecret.includes('replace-with'))) throw new Error('生产环境必须配置至少 32 位的 SESSION_SECRET')
const sessionSecret = configuredSessionSecret || 'development-only-session-secret-do-not-use-in-production'
const sessionCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 }
const securityPolicy = createSecurityPolicy()
const sessionSecurity = createSessionSecurity()
const permissionService = createPermissionService(pool)
const requirePermission = createPermissionMiddleware(permissionService)
const requireAnyPermission = createAnyPermissionMiddleware(permissionService)

await Promise.all(['original', 'thumbnail', 'system'].map((directory) => fs.mkdir(path.join(uploadRoot, directory), { recursive: true })))
await initDatabase()
await securityPolicy.load(pool, mapSecuritySettings)

const PgSession = connectPgSimple(session)
app.locals.sessionCookie = sessionCookie
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '20mb' }))
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
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
app.use(normalizeVersionedApi)

const ssoModule = createSsoModule({ pool, mapUser, establishSession: sessionSecurity.establishSession, permissionService })
const healthModule = createHealthModule(pool)
const identityModule = createIdentityModule({ pool, mapUser, securityPolicy, sessionSecurity, permissionService })
const settingsModule = createSettingsModule({ pool, uploadRoot, mapSystemSettings, mapSecuritySettings, securityPolicy })
const workbenchModule = createWorkbenchModule({ pool, uploadRoot, mapApp, ssoService: ssoModule.service })
const modelProviderModule = createModelProviderModule({ pool, encryptionKey: process.env.MODEL_PROVIDER_ENCRYPTION_KEY || sessionSecret })
const dependencies = {
  asyncRoute,
  requireAuth,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  permissionService,
  rateLimiter: securityPolicy.rateLimiter,
  ssoModule,
  healthModule,
  identityModule,
  settingsModule,
  workbenchModule,
  modelProviderModule,
  pool,
}

const businessModules = await loadBusinessModules({
  directory: process.env.MODULES_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'modules'),
  enabled: process.env.ENABLED_MODULES,
  dependencies,
})
registerPublicPlatformModules(app, dependencies)
app.use('/api', sessionSecurity.requireCsrf)
app.use('/api', securityPolicy.rateLimiter)
registerProtectedPlatformModules(app, dependencies)
registerBusinessModules(app, dependencies, businessModules)
await startModules(businessModules, dependencies)

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error.code === '23505') return res.status(409).json({ message: '编码已存在' })
  res.status(error.status || 500).json({ message: error.message || '服务器错误' })
})

const server = app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`))
const shutdown = async () => {
  await stopModules(businessModules, dependencies)
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
