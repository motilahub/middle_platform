import { createSecretCipher } from '../../shared/secret-crypto.js'
import { createModelProviderController } from './controller.js'
import { createProviderClient } from './provider-client.js'
import { createModelProviderRepository } from './repository.js'
import { registerModelProviderRoutes } from './routes.js'
import { createModelProviderService } from './service.js'

export function createModelProviderModule({ pool, encryptionKey }) {
  const repository = createModelProviderRepository(pool)
  const service = createModelProviderService(repository, createSecretCipher(encryptionKey), createProviderClient())
  const controller = createModelProviderController(service)
  return { service, registerRoutes: (app, dependencies) => registerModelProviderRoutes(app, controller, dependencies) }
}
