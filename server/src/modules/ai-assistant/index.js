import { createAiAssistantController } from './controller.js'
import { createAiAttachmentStore } from './attachments.js'
import { createAiAssistantRepository } from './repository.js'
import { registerAiAssistantRoutes } from './routes.js'
import { createAiAssistantService } from './service.js'

export const manifest = {
  key: 'ai-assistant',
  version: '0.1.0',
  enabledByDefault: true,
  dependencies: ['platform.model-providers'],
  permissions: ['platform.ai_agent.read', 'platform.ai_agent.create', 'platform.ai_agent.write', 'platform.ai_agent.unlink'],
}

export function createModule({ pool, modelProviderModule, settingsModule, uploadRoot }) {
  const repository = createAiAssistantRepository(pool)
  const service = createAiAssistantService(repository, modelProviderModule.service, createAiAttachmentStore(uploadRoot), settingsModule?.service)
  const controller = createAiAssistantController(service)
  return {
    manifest,
    service,
    migrate: async () => {},
    register: (_app, dependencies) => registerAiAssistantRoutes(_app, controller, dependencies),
  }
}
