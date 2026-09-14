import type { User } from '../../types'

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
  clientSecret?: string
  hasClientSecret?: boolean
  userIdentifier: string
  ticketTtlSeconds: number
  enabled: boolean
  remark?: string
  priority: number
  createdAt?: string
  updatedAt?: string
}

export interface SsoExchangeResult extends User {
  redirectUrl?: string
}

export interface SsoLaunchResult {
  redirectUrl: string
  expiresAt: string
}
