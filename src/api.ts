import { DashboardApp, SecuritySettings, SystemSettings, User } from './types'
import { clearCsrfToken, request } from './shared/api-client'

export const api = {
  login: (code: string, password: string) => request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ code, password }) }),
  logout: async () => { try { return await request<void>('/api/auth/logout', { method: 'POST' }) } finally { clearCsrfToken() } },
  me: () => request<User>('/api/auth/me'),
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
}
