import { Spin } from 'antd'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'

export default function RouteGuard({ children, adminOnly = false, requiredPermission, requiredAnyPermissions }: { children: JSX.Element; adminOnly?: boolean; requiredPermission?: string; requiredAnyPermissions?: string[] }) {
  const { user, loading, can, canAny } = useAuth()
  const location = useLocation()
  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  if (adminOnly && user.role === 'user') return <Navigate to="/" replace />
  if (requiredPermission && !can(requiredPermission)) return <Navigate to="/" replace />
  if (requiredAnyPermissions && !canAny(requiredAnyPermissions)) return <Navigate to="/" replace />
  return children
}
