import { useState } from 'react'
import { Button, Drawer, Grid, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { AppstoreOutlined, HomeOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, SafetyCertificateOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useSystemSettings } from '../../system-settings'
import UserMenu from '../../platform/identity/UserMenu'

export default function ConfigLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, can } = useAuth()
  const screens = Grid.useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { settings, defaultLogo } = useSystemSettings()
  const selectedKey = location.pathname.includes('/permission-groups') ? 'permission-groups' : location.pathname.includes('/basic-config') ? 'basic-config' : location.pathname.includes('/system-security') ? 'system-security' : location.pathname.includes('/sso/inbound') ? 'sso-inbound' : location.pathname.includes('/sso/outbound') ? 'sso-outbound' : location.pathname.includes('users') ? 'users' : location.pathname.includes('dashboard') ? 'dashboard' : 'workbench'
  const ssoMenu = can('platform.sso.read') ? { key: 'sso-config', label: '单点登录', children: [{ key: 'sso-inbound', label: '外部访入', onClick: () => navigate('/config/sso/inbound') }, { key: 'sso-outbound', label: '内部访出', onClick: () => navigate('/config/sso/outbound') }] } : null
  const menuItems = [
    { key: 'workbench', icon: <HomeOutlined />, label: '工作台', onClick: () => navigate('/') },
    can('platform.app.read') && { key: 'dashboard', icon: <AppstoreOutlined />, label: '工作台配置', onClick: () => navigate('/config/dashboard') },
    can('platform.user.read') && { key: 'users', icon: <UserOutlined />, label: '用户管理', onClick: () => navigate('/config/users') },
    (can('platform.settings.read') || can('platform.permission.read') || ssoMenu) && { key: 'system-config', icon: <SettingOutlined />, label: '系统配置', children: [can('platform.settings.read') && { key: 'basic-config', label: '基础配置', onClick: () => navigate('/config/basic-config') }, can('platform.settings.read') && { key: 'system-security', label: '系统安全', onClick: () => navigate('/config/system-security') }, can('platform.permission.read') && { key: 'permission-groups', icon: <SafetyCertificateOutlined />, label: '权限管理', onClick: () => navigate('/config/permission-groups') }, ssoMenu].filter(Boolean) },
  ].filter(Boolean)
  const menu = <Menu mode="inline" inlineCollapsed={collapsed && !!screens.md} selectedKeys={[selectedKey]} items={menuItems as MenuProps['items']} onClick={() => setMobileMenuOpen(false)} />
  const brand = <div className="sider-brand"><img className="brand-mark small" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} />{(!collapsed || !screens.md) && <strong>{settings.systemTitle}</strong>}</div>
  const toggleMenu = () => screens.md ? setCollapsed((value) => !value) : setMobileMenuOpen(true)

  return <Layout className="config-layout">
    <Layout.Sider width={240} collapsedWidth={64} collapsible collapsed={collapsed} trigger={null} theme="light">{brand}{menu}</Layout.Sider>
    <Layout>
      <Layout.Header className="config-header"><Button className="config-header-menu" type="text" icon={screens.md ? (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : <MenuOutlined />} onClick={toggleMenu} title={screens.md ? (collapsed ? '展开菜单' : '收起菜单') : '展开菜单'} /><Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button><UserMenu user={user!} onLogout={onLogout} /></Layout.Header>
      <Layout.Content className="config-content"><Outlet /></Layout.Content>
      {settings.footerRecord && <Layout.Footer className="config-footer">{settings.footerRecord}</Layout.Footer>}
    </Layout>
    <Drawer className="config-mobile-drawer" placement="left" width={272} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} closable={false} styles={{ body: { padding: 0 } }}>{brand}{menu}</Drawer>
  </Layout>
}
