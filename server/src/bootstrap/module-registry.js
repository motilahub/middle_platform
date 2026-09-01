import { registerSsoPublicRoutes, registerSsoRoutes } from '../platform/sso/index.js'

/**
 * The API entry point uses these two registration phases so public platform
 * endpoints can be mounted before CSRF middleware and protected endpoints can
 * be mounted after it. Future platform and business modules belong here.
 */
export function registerPublicPlatformModules(app, dependencies) {
  registerSsoPublicRoutes(app, dependencies.ssoModule.controller, {
    asyncRoute: dependencies.asyncRoute,
    rateLimiter: dependencies.rateLimiter,
  })
}

export function registerProtectedPlatformModules(app, dependencies) {
  registerSsoRoutes(app, dependencies.ssoModule.controller, {
    asyncRoute: dependencies.asyncRoute,
    requireAuth: dependencies.requireAuth,
    requireAdmin: dependencies.requireAdmin,
  })
}

export function registerApiModules(app, dependencies, modules = []) {
  const keys = new Set()
  for (const module of modules) {
    if (!module?.key || typeof module.register !== 'function') throw new Error('API 模块必须提供 key 和 register 函数')
    if (keys.has(module.key)) throw new Error(`API 模块重复注册: ${module.key}`)
    keys.add(module.key)
    module.register(app, dependencies)
  }
}

export function registerBusinessModules(app, dependencies, modules = []) {
  registerApiModules(app, dependencies, modules)
}
