import { createSettingsController } from './controller.js'
import { createSettingsImageStore } from './image.js'
import { createSettingsRepository } from './repository.js'
import { registerSettingsRoutes } from './routes.js'
import { createSettingsService } from './service.js'

export function createSettingsModule({ pool, uploadRoot, mapSystemSettings, mapSecuritySettings, securityPolicy }) {
  const repository = createSettingsRepository(pool)
  const imageStore = createSettingsImageStore(uploadRoot)
  const service = createSettingsService(repository, imageStore, { mapSystemSettings, mapSecuritySettings }, securityPolicy)
  const controller = createSettingsController(service)
  return { service, registerRoutes: (app, dependencies) => registerSettingsRoutes(app, controller, dependencies) }
}

