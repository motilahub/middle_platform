import { DashboardApp, DashboardCategory, PermissionDefinition, PermissionGroup, SecuritySettings, SystemSettings, User } from './types'
import { clearCsrfToken, request } from './shared/api-client'

export const apiRequest = request

export const api = {
  login: (code: string, password: string) => request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ code, password }) }),
  authOptions: () => request<{ registrationEnabled: boolean }>('/api/auth/options'),
  sendAuthCode: (purpose: 'register' | 'reset', email: string) => request<{ message: string }>('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ purpose, email }) }),
  register: (body: { name: string; login: string; password: string; email: string; phone?: string; code: string }) => request<{ message: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body: { email: string; code: string; password: string }) => request<void>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  authMailSettings: () => request<AuthMailSettings>('/api/admin/auth-mail-settings'),
  updateAuthMailSettings: (body: AuthMailSettings & { smtpPassword?: string }) => request<AuthMailSettings>('/api/admin/auth-mail-settings', { method: 'PUT', body: JSON.stringify(body) }),
  testAuthMail: (email: string) => request<void>('/api/admin/auth-mail-settings/test', { method: 'POST', body: JSON.stringify({ email }) }),
  authEvents: (page: number, pageSize: number, action?: string, keyword?: string) => request<AuthEventPage>(`/api/admin/auth-events?page=${page}&pageSize=${pageSize}&action=${encodeURIComponent(action || '')}&keyword=${encodeURIComponent(keyword || '')}`),
  logout: async () => { try { return await request<void>('/api/auth/logout', { method: 'POST' }) } finally { clearCsrfToken() } },
  me: () => request<User>('/api/auth/me'),
  updateMyProfile: (profile: Pick<User, 'avatar'>) => request<User>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  systemSettings: () => request<SystemSettings>('/api/system/settings'),
  adminSystemSettings: () => request<SystemSettings>('/api/admin/system-settings'),
  updateSystemSettings: (settings: SystemSettings) => request<SystemSettings>('/api/admin/system-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  adminSecuritySettings: () => request<SecuritySettings>('/api/admin/security-settings'),
  updateSecuritySettings: (settings: SecuritySettings) => request<SecuritySettings>('/api/admin/security-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  aiChatSettings: () => request<SystemSettings>('/api/admin/ai-chat-settings'),
  updateAiChatSettings: (settings: Pick<SystemSettings, 'aiChatWelcome' | 'aiChatFirstPromptCount' | 'aiChatMaxRounds' | 'aiChatFollowupCount' | 'aiChatRobotIcon' | 'aiChatTheme' | 'aiChatEffects'>) => request<SystemSettings>('/api/admin/ai-chat-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  visibleApps: () => request<DashboardApp[]>('/api/workbench/apps'),
  adminCategories: () => request<DashboardCategory[]>('/api/admin/app-categories'),
  createCategory: (category: Omit<DashboardCategory, 'id'>) => request<{ id: number }>('/api/admin/app-categories', { method: 'POST', body: JSON.stringify(category) }),
  updateCategory: (id: number, category: Omit<DashboardCategory, 'id'>) => request<void>(`/api/admin/app-categories/${id}`, { method: 'PUT', body: JSON.stringify(category) }),
  deleteCategory: (id: number) => request<void>(`/api/admin/app-categories/${id}`, { method: 'DELETE' }),
  adminApps: () => request<DashboardApp[]>('/api/admin/apps'),
  createApp: (app: Omit<DashboardApp, 'id'>) => request<{ id: number }>('/api/admin/apps', { method: 'POST', body: JSON.stringify(app) }),
  updateApp: (id: number, app: DashboardApp) => request<void>(`/api/admin/apps/${id}`, { method: 'PUT', body: JSON.stringify(app) }),
  toggleApp: (id: number, enabled: boolean) => request<void>(`/api/admin/apps/${id}/visible`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  reorderApps: (ids: number[]) => request<void>('/api/admin/apps/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  deleteApp: (id: number) => request<void>(`/api/admin/apps/${id}`, { method: 'DELETE' }),
  deleteApps: (ids: number[]) => request<void>('/api/admin/apps', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  users: () => request<User[]>('/api/admin/users'),
  permissionGroups: () => request<PermissionGroup[]>('/api/admin/permission-groups'),
  permissionDefinitions: () => request<PermissionDefinition[]>('/api/admin/permissions'),
  createPermissionGroup: (group: Omit<PermissionGroup, 'id'>) => request<{ id: number }>('/api/admin/permission-groups', { method: 'POST', body: JSON.stringify(group) }),
  updatePermissionGroup: (id: number, group: Omit<PermissionGroup, 'id'>) => request<void>(`/api/admin/permission-groups/${id}`, { method: 'PUT', body: JSON.stringify(group) }),
  deletePermissionGroup: (id: number) => request<void>(`/api/admin/permission-groups/${id}`, { method: 'DELETE' }),
  createUser: (user: Partial<User> & { password: string; groupIds?: number[] }) => request<User>('/api/admin/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: number, user: Partial<User>) => request<User>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
  deleteUser: (id: number) => request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
}

export interface AuthMailSettings { registrationEnabled: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; senderEmail: string; hasPassword: boolean }
export interface AuthEvent { id: number; action: string; outcome: string; ip_address: string | null; user_code: string | null; created_at: string }
export interface AuthEventPage { rows: AuthEvent[]; total: number; page: number; pageSize: number }
