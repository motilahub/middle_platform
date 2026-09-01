import { createSsoController } from './controller.js'
import { createSsoRepository } from './repository.js'
import { createSsoService } from './service.js'

export function createSsoModule({ pool, mapUser, establishSession }) {
  const repository = createSsoRepository(pool)
  const service = createSsoService(repository, mapUser)
  const controller = createSsoController(service, establishSession)
  return { controller, service }
}

export { registerSsoPublicRoutes, registerSsoRoutes } from './routes.js'
