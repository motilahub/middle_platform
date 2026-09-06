import { request, requestStream } from '../../shared/api-client'
import { AiAgent, AiAttachment, AiConversation, AiKnowledgeBase, AiMessage, AiModelProvider, AiSkill } from './types'

export const aiApi = {
  models: () => request<AiModelProvider[]>('/api/ai/models'),
  agents: () => request<AiAgent[]>('/api/ai/agents'),
  adminAgents: () => request<AiAgent[]>('/api/admin/ai-agents'),
  createAgent: (body: Omit<AiAgent, 'id' | 'createdAt' | 'updatedAt' | 'settings'> & { settings?: Record<string, unknown> }) => request<AiAgent>('/api/admin/ai-agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (id: number, body: Partial<Omit<AiAgent, 'id' | 'createdAt' | 'updatedAt'>>) => request<AiAgent>(`/api/admin/ai-agents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAgent: (id: number) => request<void>(`/api/admin/ai-agents/${id}`, { method: 'DELETE' }),
  knowledgeBases: () => request<AiKnowledgeBase[]>('/api/ai/knowledge-bases'),
  createKnowledgeBase: (body: { name: string; description?: string }) => request<AiKnowledgeBase>('/api/ai/knowledge-bases', { method: 'POST', body: JSON.stringify(body) }),
  createKnowledgeDocument: (id: number, body: { title: string; content: string }) => request<{ id: number; title: string; createdAt: string }>(`/api/ai/knowledge-bases/${id}/documents`, { method: 'POST', body: JSON.stringify(body) }),
  skills: () => request<AiSkill[]>('/api/ai/skills'),
  uploadAttachment: (body: { name: string; dataUrl: string }) => request<AiAttachment>('/api/ai/attachments', { method: 'POST', body: JSON.stringify(body) }),
  conversations: () => request<AiConversation[]>('/api/ai/conversations'),
  createConversation: (body: { title?: string; agentId?: number }) => request<AiConversation>('/api/ai/conversations', { method: 'POST', body: JSON.stringify(body) }),
  conversation: (id: number) => request<AiConversation>(`/api/ai/conversations/${id}`),
  deleteConversation: (id: number) => request<void>(`/api/ai/conversations/${id}`, { method: 'DELETE' }),
  messages: (id: number) => request<AiMessage[]>(`/api/ai/conversations/${id}/messages`),
  sendMessage: (id: number, body: { content: string; agentId?: number; attachments?: AiAttachment[]; skill?: string; knowledgeBaseId?: number }) => requestStream(`/api/ai/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
}
