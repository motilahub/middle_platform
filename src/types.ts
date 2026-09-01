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
