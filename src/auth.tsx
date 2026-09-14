import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { User } from './types'

interface AuthValue {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
  canAny: (permissions: string[]) => boolean
}
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = async () => { try { setUser(await api.me()) } catch { setUser(null) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  const logout = async () => { try { await api.logout() } finally { setUser(null) } }
  const can = (permission: string) => user?.role === 'super_admin' || !!user?.permissions?.includes(permission)
  const canAny = (permissions: string[]) => permissions.some(can)
  return <AuthContext.Provider value={{ user, loading, refresh, logout, can, canAny }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)!
