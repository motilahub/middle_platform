export type UserRole = 'super_admin' | 'admin' | 'user'

export interface User {
  id: number
  uuid: string
  code: string
  name: string
  password?: string
  role: UserRole
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
  enabled: boolean
  userIds: number[]
}

export type SsoDirection = 'inbound' | 'outbound'
export type SsoProtocol = 'oidc' | 'cas' | 'ticket' | 'saml'

export interface SsoConfig {
  id: number
  code: string
  name: string
  direction: SsoDirection
  protocol: SsoProtocol
  systemUrl: string
  verifyUrl?: string
  authorizeUrl?: string
  callbackUrl?: string
  issuer?: string
  clientId?: string
  userIdentifier: string
  enabled: boolean
  remark?: string
  priority: number
  createdAt?: string
  updatedAt?: string
}

export interface SsoExchangeResult extends User {
  redirectUrl?: string
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
