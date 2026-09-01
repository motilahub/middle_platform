import { Layout, Menu, Button, Typography } from 'antd'
import { AppstoreOutlined, HomeOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { roleLabels } from '../../store'
import { useAuth } from '../../auth'
import logo from '../../images/logo.png'

export default function ConfigLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate(); const location = useLocation(); const { user } = useAuth()
  return <Layout className="config-layout"><Layout.Sider width={220} theme="light"><div className="sider-brand"><img className="brand-mark small" src={logo} alt="AI财务助手" /><strong>工作台管理</strong></div><Menu mode="inline" selectedKeys={[location.pathname === '/' ? 'workbench' : location.pathname.includes('users') ? 'users' : 'dashboard']} items={[{ key: 'workbench', icon: <HomeOutlined />, label: '工作台', onClick: () => navigate('/') }, { key: 'dashboard', icon: <AppstoreOutlined />, label: '工作台配置', onClick: () => navigate('/config/dashboard') }, { key: 'users', icon: <UserOutlined />, label: '用户管理', onClick: () => navigate('/config/users') }]} /></Layout.Sider><Layout><Layout.Header className="config-header"><Typography.Text>{user!.name} · {roleLabels[user!.role]}</Typography.Text><Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>退出</Button></Layout.Header><Layout.Content className="config-content"><Outlet /></Layout.Content></Layout></Layout>
}
