export type UserRole = 'super_admin' | 'admin' | 'user'

export interface User {
  id: number
  uuid: string
  code: string
  name: string
  password?: string
  role: UserRole
  groups?: Array<{ code: string; name: string }>
  groupIds?: number[]
  permissions?: string[]
}

export interface PermissionGroup {
  id: number
  code: string
  name: string
  description?: string
  permissions: string[]
  impliedGroupIds?: number[]
}

export interface PermissionDefinition {
  code: string
  module: string
  resource: string
  operation: string
  name: string
}

export interface DashboardApp {
  id: number
  code: string
  name: string
  priority: number
  url: string
  img?: string
  imgThumbnail?: string
  imgFileName?: string
  outboundSsoConfigId?: number
  enabled: boolean
  visibility: 'public' | 'private'
  userIds: number[]
}

export interface SystemSettings {
  systemTitle: string
  browserTitle: string
  systemLogo?: string | null
  titleLogo?: string | null
  loginText: string
  footerRecord?: string
  showWorkbenchHeader: boolean
  updatedAt?: string
}

export interface SecuritySettings {
  apiRateLimitPerMinute: number
  passwordMinLength: number
  passwordRequireUppercase: boolean
  passwordRequireLowercase: boolean
  passwordRequireSpecial: boolean
  passwordRequireNumber: boolean
  updatedAt?: string
}
