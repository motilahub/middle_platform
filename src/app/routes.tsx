import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../auth'
import Login from '../pages/Login'
import Workbench from '../pages/Workbench'
import ConfigLayout from '../pages/config/ConfigLayout'
import DashboardConfig from '../pages/config/DashboardConfig'
import UserConfig from '../pages/config/UserConfig'
import SsoConfig from '../pages/config/SsoConfig'
import BasicConfig from '../pages/config/SystemSecurityConfig'
import SecurityConfig from '../pages/config/SecurityConfig'
import PermissionGroupConfig from '../pages/config/PermissionGroupConfig'
import { getBusinessRouteElements } from '../modules/registry'

function Guard({ children, adminOnly = false, requiredPermission, requiredAnyPermissions }: { children: JSX.Element; adminOnly?: boolean; requiredPermission?: string; requiredAnyPermissions?: string[] }) {
  const { user, loading, can, canAny } = useAuth()
  const location = useLocation()
  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (adminOnly && user.role === 'user') return <Navigate to="/" replace />
  if (requiredPermission && !can(requiredPermission)) return <Navigate to="/" replace />
  if (requiredAnyPermissions && !canAny(requiredAnyPermissions)) return <Navigate to="/" replace />
  return children
}

function ConfigIndexRedirect() {
  const { can } = useAuth()
  if (can('platform.app.read')) return <Navigate to="dashboard" replace />
  if (can('platform.user.read')) return <Navigate to="users" replace />
  if (can('platform.permission.read')) return <Navigate to="permission-groups" replace />
  if (can('platform.settings.read')) return <Navigate to="basic-config" replace />
  if (can('platform.sso.read')) return <Navigate to="sso/inbound" replace />
  return <Navigate to="/" replace />
}

export default function AppRoutes() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }) }

  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<Workbench />} />
    <Route path="/config" element={<Guard requiredAnyPermissions={['platform.app.read', 'platform.user.read', 'platform.settings.read', 'platform.sso.read']}><ConfigLayout onLogout={handleLogout} /></Guard>}>
      <Route index element={<ConfigIndexRedirect />} />
      <Route path="dashboard" element={<Guard requiredPermission="platform.app.read"><DashboardConfig /></Guard>} />
      <Route path="users" element={<Guard requiredPermission="platform.user.read"><UserConfig /></Guard>} />
      <Route path="permission-groups" element={<Guard requiredPermission="platform.permission.read"><PermissionGroupConfig /></Guard>} />
      <Route path="basic-config" element={<Guard requiredPermission="platform.settings.read"><BasicConfig /></Guard>} />
      <Route path="system-security" element={<Guard requiredPermission="platform.settings.read"><SecurityConfig /></Guard>} />
      <Route path="sso/inbound" element={<Guard requiredPermission="platform.sso.read"><SsoConfig direction="inbound" /></Guard>} />
      <Route path="sso/outbound" element={<Guard requiredPermission="platform.sso.read"><SsoConfig direction="outbound" /></Guard>} />
    </Route>
    {getBusinessRouteElements()}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
