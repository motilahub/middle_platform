import { createIdentityController } from './controller.js'
import { createIdentityRepository } from './repository.js'
import { createIdentityService } from './service.js'
import { registerIdentityPublicRoutes, registerIdentityRoutes } from './routes.js'
import { createIdentityImageStore } from './image.js'
import { createAuthRepository } from './auth-repository.js'
import { createAuthService } from './auth-service.js'
import { createSecretCipher } from '../../shared/secret-crypto.js'

export function createIdentityModule({ pool, uploadRoot, mapUser, securityPolicy, sessionSecurity, permissionService, encryptionKey }) {
  const repository = createIdentityRepository(pool)
  const imageStore = createIdentityImageStore(uploadRoot)
  const service = createIdentityService(repository, mapUser, securityPolicy, permissionService, imageStore)
  const authService = createAuthService(createAuthRepository(pool), { pool, securityPolicy, cipher: createSecretCipher(encryptionKey), secret: encryptionKey })
  const controller = createIdentityController(service, sessionSecurity, authService)
  return {
    service,
    authService,
    controller,
    registerPublicRoutes: (app) => registerIdentityPublicRoutes(app, sessionSecurity, controller),
    registerRoutes: (app, dependencies) => registerIdentityRoutes(app, controller, dependencies),
  }
}
