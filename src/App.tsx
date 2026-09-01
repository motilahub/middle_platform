import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAuth } from './auth'
import Login from './pages/Login'
import Workbench from './pages/Workbench'
import ConfigLayout from './pages/config/ConfigLayout'
import DashboardConfig from './pages/config/DashboardConfig'
import UserConfig from './pages/config/UserConfig'
import SsoConfig from './pages/config/SsoConfig'

function Guard({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (adminOnly && user.role === 'user') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }) }
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}><AntApp>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Guard><Workbench /></Guard>} />
      <Route path="/config" element={<Guard adminOnly><ConfigLayout onLogout={handleLogout} /></Guard>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardConfig />} />
        <Route path="users" element={<UserConfig />} />
        <Route path="sso/inbound" element={<SsoConfig direction="inbound" />} />
        <Route path="sso/outbound" element={<SsoConfig direction="outbound" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AntApp></ConfigProvider>
}
