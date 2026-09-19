export type UserRole = 'super_admin' | 'admin' | 'user'

export interface User {
  id: number
  uuid: string
  code: string
  name: string
  avatar?: string | null
  avatarOriginal?: string | null
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

export interface DashboardCategory {
  id: number
  code: string
  name: string
  priority: number
}

export interface DashboardApp {
  id: number
  code: string
  name: string
  priority: number
  categoryId?: number
  categoryCode?: string
  categoryName?: string
  categoryPriority?: number
  url: string
  img?: string
  imgThumbnail?: string
  imgFileName?: string
  outboundSsoConfigId?: number
  openMode: 'current' | 'new_tab'
  enabled: boolean
  visibility: 'public' | 'private'
  userIds: number[]
}

export interface SystemSettings {
  systemTitle: string
  browserTitle: string
  systemLogo?: string | null
  systemLogoOriginal?: string | null
  titleLogo?: string | null
  titleLogoOriginal?: string | null
  loginText: string
  footerRecord?: string
  showWorkbenchHeader: boolean
  showAiChatHeader: boolean
  aiChatWelcome: string
  aiChatFirstPromptCount: number
  aiChatMaxRounds: number
  aiChatFollowupCount: number
  aiChatRobotIcon?: string
  aiChatRobotIconOriginal?: string
  aiChatTheme: 'light' | 'dark' | 'nature'
  aiChatEffects: boolean
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
