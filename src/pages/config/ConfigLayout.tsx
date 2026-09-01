import { Layout, Menu, Button, Typography } from 'antd'
import { AppstoreOutlined, HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { roleLabels } from '../../store'
import { useAuth } from '../../auth'
import logo from '../../images/logo.png'

export default function ConfigLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate(); const location = useLocation(); const { user } = useAuth()
  const selectedKey = location.pathname.includes('/sso/inbound') ? 'sso-inbound' : location.pathname.includes('/sso/outbound') ? 'sso-outbound' : location.pathname.includes('users') ? 'users' : location.pathname.includes('dashboard') ? 'dashboard' : 'workbench'
  return <Layout className="config-layout"><Layout.Sider width={240} theme="light"><div className="sider-brand"><img className="brand-mark small" src={logo} alt="AI财务助手" /><strong>工作台管理</strong></div><Menu mode="inline" selectedKeys={[selectedKey]} items={[{ key: 'workbench', icon: <HomeOutlined />, label: '工作台', onClick: () => navigate('/') }, { key: 'dashboard', icon: <AppstoreOutlined />, label: '工作台配置', onClick: () => navigate('/config/dashboard') }, { key: 'users', icon: <UserOutlined />, label: '用户管理', onClick: () => navigate('/config/users') }, { key: 'system-config', icon: <SettingOutlined />, label: '系统配置', children: [{ key: 'sso-config', label: '单点登录', children: [{ key: 'sso-inbound', label: '外部访入', onClick: () => navigate('/config/sso/inbound') }, { key: 'sso-outbound', label: '内部访出', onClick: () => navigate('/config/sso/outbound') }] }] }]} /></Layout.Sider><Layout><Layout.Header className="config-header"><Typography.Text>{user!.name} · {roleLabels[user!.role]}</Typography.Text><Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>退出</Button></Layout.Header><Layout.Content className="config-content"><Outlet /></Layout.Content></Layout></Layout>
}
