import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { User } from './types'

interface AuthValue { user: User | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = async () => { try { setUser(await api.me()) } catch { setUser(null) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  const logout = async () => { try { await api.logout() } finally { setUser(null) } }
  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)!
