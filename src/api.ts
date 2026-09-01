import { DashboardApp, SecuritySettings, SsoConfig, SsoDirection, SsoExchangeResult, SystemSettings, User } from './types'

let csrfToken: string | undefined
async function refreshCsrfToken() {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.token) throw new Error(body.message || '无法建立安全请求会话')
  csrfToken = body.token
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !csrfToken) await refreshCsrfToken()
  const headers = new Headers({ 'content-type': 'application/json', ...options.headers })
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token', csrfToken)
  const response = await fetch(url, { credentials: 'include', ...options, headers })
  const nextCsrfToken = response.headers.get('x-csrf-token')
  if (nextCsrfToken) csrfToken = nextCsrfToken
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || '请求失败')
  return body as T
}

export const api = {
  login: (code: string, password: string) => request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ code, password }) }),
  logout: async () => { try { return await request<void>('/api/auth/logout', { method: 'POST' }) } finally { csrfToken = undefined } },
  me: () => request<User>('/api/auth/me'),
  exchangeSsoTicket: (code: string, ticket: string) => request<SsoExchangeResult>(`/api/auth/sso/${encodeURIComponent(code)}/exchange`, { method: 'POST', body: JSON.stringify({ ticket }) }),
  systemSettings: () => request<SystemSettings>('/api/system/settings'),
  adminSystemSettings: () => request<SystemSettings>('/api/admin/system-settings'),
  updateSystemSettings: (settings: SystemSettings) => request<SystemSettings>('/api/admin/system-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  adminSecuritySettings: () => request<SecuritySettings>('/api/admin/security-settings'),
  updateSecuritySettings: (settings: SecuritySettings) => request<SecuritySettings>('/api/admin/security-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  visibleApps: () => request<DashboardApp[]>('/api/me/apps'),
  adminApps: () => request<DashboardApp[]>('/api/admin/apps'),
  createApp: (app: Omit<DashboardApp, 'id'>) => request<{ id: number }>('/api/admin/apps', { method: 'POST', body: JSON.stringify(app) }),
  updateApp: (id: number, app: DashboardApp) => request<void>(`/api/admin/apps/${id}`, { method: 'PUT', body: JSON.stringify(app) }),
  toggleApp: (id: number, enabled: boolean) => request<void>(`/api/admin/apps/${id}/visible`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  reorderApps: (ids: number[]) => request<void>('/api/admin/apps/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  deleteApp: (id: number) => request<void>(`/api/admin/apps/${id}`, { method: 'DELETE' }),
  deleteApps: (ids: number[]) => request<void>('/api/admin/apps', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  users: () => request<User[]>('/api/admin/users'),
  createUser: (user: Partial<User> & { password: string }) => request<User>('/api/admin/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: number, user: Partial<User>) => request<void>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
  deleteUser: (id: number) => request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  ssoConfigs: (direction: SsoDirection) => request<SsoConfig[]>(`/api/admin/sso/${direction}`),
  createSsoConfig: (direction: SsoDirection, config: Omit<SsoConfig, 'id' | 'direction'>) => request<{ id: number }>(`/api/admin/sso/${direction}`, { method: 'POST', body: JSON.stringify(config) }),
  updateSsoConfig: (direction: SsoDirection, id: number, config: Omit<SsoConfig, 'id' | 'direction'>) => request<void>(`/api/admin/sso/${direction}/${id}`, { method: 'PUT', body: JSON.stringify(config) }),
  toggleSsoConfig: (direction: SsoDirection, id: number, enabled: boolean) => request<void>(`/api/admin/sso/${direction}/${id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteSsoConfig: (direction: SsoDirection, id: number) => request<void>(`/api/admin/sso/${direction}/${id}`, { method: 'DELETE' }),
  deleteSsoConfigs: (direction: SsoDirection, ids: number[]) => request<void>(`/api/admin/sso/${direction}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),
}
