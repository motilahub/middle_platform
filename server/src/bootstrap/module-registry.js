import { registerSsoPublicRoutes, registerSsoRoutes } from '../platform/sso/index.js'
import { registerApiModules } from './module-contract.js'

/**
 * The API entry point uses these two registration phases so public platform
 * endpoints can be mounted before CSRF middleware and protected endpoints can
 * be mounted after it. Future platform and business modules belong here.
 */
export function registerPublicPlatformModules(app, dependencies) {
  registerApiModules(app, dependencies, [
    { key: 'platform.identity.public', register: () => dependencies.identityModule.registerPublicRoutes(app) },
    { key: 'platform.sso.public', register: () => registerSsoPublicRoutes(app, dependencies.ssoModule.controller, { asyncRoute: dependencies.asyncRoute, rateLimiter: dependencies.rateLimiter }) },
    { key: 'platform.health', register: () => dependencies.healthModule.registerRoutes(app, dependencies) },
  ])
}

export function registerProtectedPlatformModules(app, dependencies) {
  registerApiModules(app, dependencies, [
    { key: 'platform.sso', register: () => registerSsoRoutes(app, dependencies.ssoModule.controller, { asyncRoute: dependencies.asyncRoute, requireAuth: dependencies.requireAuth, requirePermission: dependencies.requirePermission }) },
    { key: 'platform.identity', register: () => dependencies.identityModule.registerRoutes(app, dependencies) },
    { key: 'platform.workbench', register: () => dependencies.workbenchModule.registerRoutes(app, dependencies) },
    { key: 'platform.settings', register: () => dependencies.settingsModule.registerRoutes(app, dependencies) },
    { key: 'platform.model-providers', register: () => dependencies.modelProviderModule.registerRoutes(app, dependencies) },
  ])
}

export function registerBusinessModules(app, dependencies, modules = []) {
  registerApiModules(app, dependencies, modules)
}
