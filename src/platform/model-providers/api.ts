import { request } from '../../shared/api-client'
import type { ModelProvider, ModelProviderTestResult } from './types'

export const modelProviderApi = {
  list: () => request<ModelProvider[]>('/api/admin/model-providers'),
  create: (provider: Omit<ModelProvider, 'id' | 'hasApiKey' | 'models' | 'createdAt' | 'updatedAt'>) => request<{ id: number }>('/api/admin/model-providers', { method: 'POST', body: JSON.stringify(provider) }),
  update: (id: number, provider: Omit<ModelProvider, 'id' | 'hasApiKey' | 'models' | 'createdAt' | 'updatedAt'>) => request<void>(`/api/admin/model-providers/${id}`, { method: 'PUT', body: JSON.stringify(provider) }),
  test: (id: number) => request<ModelProviderTestResult>(`/api/admin/model-providers/${id}/test`, { method: 'POST' }),
  syncModels: (id: number) => request<{ provider: ModelProvider; models: string[] }>(`/api/admin/model-providers/${id}/models`, { method: 'POST' }),
  toggle: (id: number, enabled: boolean) => request<void>(`/api/admin/model-providers/${id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  delete: (id: number) => request<void>(`/api/admin/model-providers/${id}`, { method: 'DELETE' }),
  deleteMany: (ids: number[]) => request<void>('/api/admin/model-providers', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}
