export interface AiConversation {
  id: number
  title: string
  modelProviderId?: number
  model?: string
  agentId?: number
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: number
  conversationId: number
  role: 'system' | 'user' | 'assistant'
  content: string
  status: 'pending' | 'completed' | 'failed'
  model?: string
  errorMessage?: string
  attachments?: AiAttachment[]
  createdAt: string
}

export interface AiAttachment {
  name: string
  url: string
  mime: string
  size: number
}

export interface AiSkill {
  key: string
  name: string
  description: string
}

export interface AiKnowledgeBase {
  id: number
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface AiModelProvider {
  id: number
  code: string
  name: string
  vendor: string
  models: string[]
  defaultModel?: string
}

export interface AiAgent {
  id: number
  code: string
  name: string
  description?: string
  modelProviderId?: number
  model?: string
  systemPrompt: string
  settings: Record<string, unknown>
  enabled: boolean
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}
