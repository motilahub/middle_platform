import { createIdentityController } from './controller.js'
import { createIdentityRepository } from './repository.js'
import { createIdentityService } from './service.js'
import { registerIdentityPublicRoutes, registerIdentityRoutes } from './routes.js'

export function createIdentityModule({ pool, mapUser, securityPolicy, sessionSecurity, permissionService }) {
  const repository = createIdentityRepository(pool)
  const service = createIdentityService(repository, mapUser, securityPolicy, permissionService)
  const controller = createIdentityController(service, sessionSecurity)
  return {
    service,
    controller,
    registerPublicRoutes: (app) => registerIdentityPublicRoutes(app, sessionSecurity),
    registerRoutes: (app, dependencies) => registerIdentityRoutes(app, controller, dependencies),
  }
}
