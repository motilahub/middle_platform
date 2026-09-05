import { createWorkbenchController } from './controller.js'
import { createWorkbenchImageStore } from './image.js'
import { createWorkbenchRepository } from './repository.js'
import { registerWorkbenchRoutes } from './routes.js'
import { createWorkbenchService } from './service.js'

export function createWorkbenchModule({ pool, uploadRoot, mapApp, ssoService }) {
  const repository = createWorkbenchRepository(pool)
  const imageStore = createWorkbenchImageStore(uploadRoot)
  const service = createWorkbenchService(repository, mapApp, imageStore, ssoService)
  const controller = createWorkbenchController(service)
  return { service, registerRoutes: (app, dependencies) => registerWorkbenchRoutes(app, controller, dependencies) }
}

