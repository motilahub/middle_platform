import { registerSsoPublicRoutes, registerSsoRoutes } from '../platform/sso/index.js'
import { registerApiModules } from './module-contract.js'

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

export function registerBusinessModules(app, dependencies, modules = []) {
  registerApiModules(app, dependencies, modules)
}
