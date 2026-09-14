import { request } from '../../shared/api-client'
import type { SsoConfig, SsoDirection, SsoExchangeResult, SsoLaunchResult } from './types'

export const ssoApi = {
  exchangeTicket: (code: string, ticket: string) => request<SsoExchangeResult>(`/api/auth/sso/${encodeURIComponent(code)}/exchange`, { method: 'POST', body: JSON.stringify({ ticket }) }),
  launchApp: (id: number) => request<SsoLaunchResult>(`/api/me/apps/${id}/sso-ticket`, { method: 'POST' }),
  configs: (direction: SsoDirection) => request<SsoConfig[]>(`/api/admin/sso/${direction}`),
  createConfig: (direction: SsoDirection, config: Omit<SsoConfig, 'id' | 'direction'>) => request<{ id: number }>(`/api/admin/sso/${direction}`, { method: 'POST', body: JSON.stringify(config) }),
  updateConfig: (direction: SsoDirection, id: number, config: Omit<SsoConfig, 'id' | 'direction'>) => request<void>(`/api/admin/sso/${direction}/${id}`, { method: 'PUT', body: JSON.stringify(config) }),
  toggleConfig: (direction: SsoDirection, id: number, enabled: boolean) => request<void>(`/api/admin/sso/${direction}/${id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteConfig: (direction: SsoDirection, id: number) => request<void>(`/api/admin/sso/${direction}/${id}`, { method: 'DELETE' }),
  deleteConfigs: (direction: SsoDirection, ids: number[]) => request<void>(`/api/admin/sso/${direction}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),
}
