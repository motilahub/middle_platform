import { createIdentityController } from './controller.js'
import { createIdentityRepository } from './repository.js'
import { createIdentityService } from './service.js'
import { registerIdentityPublicRoutes, registerIdentityRoutes } from './routes.js'
import { createIdentityImageStore } from './image.js'

export function createIdentityModule({ pool, uploadRoot, mapUser, securityPolicy, sessionSecurity, permissionService }) {
  const repository = createIdentityRepository(pool)
  const imageStore = createIdentityImageStore(uploadRoot)
  const service = createIdentityService(repository, mapUser, securityPolicy, permissionService, imageStore)
  const controller = createIdentityController(service, sessionSecurity)
  return {
    service,
    controller,
    registerPublicRoutes: (app) => registerIdentityPublicRoutes(app, sessionSecurity),
    registerRoutes: (app, dependencies) => registerIdentityRoutes(app, controller, dependencies),
  }
}
