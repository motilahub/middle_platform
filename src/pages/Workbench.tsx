import { App, Button, Empty, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DashboardApp } from '../types'
import { ssoApi } from '../platform/sso/api'
import { useSystemSettings } from '../system-settings'
import { useAuth } from '../auth'
import UserMenu from '../platform/identity/UserMenu'

export default function Workbench() {
  const [apps, setApps] = useState<DashboardApp[] | null>(null)
  const [openingAppId, setOpeningAppId] = useState<number | null>(null)
  const { message } = App.useApp()
  const { settings, defaultLogo } = useSystemSettings()
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { api.visibleApps().then(setApps).catch((error) => message.error((error as Error).message)) }, [message, user?.id])
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  const openApp = async (dashboardApp: DashboardApp) => {
    if (!dashboardApp.outboundSsoConfigId) { open(dashboardApp.url); return }
    const popup = window.open('about:blank', '_blank')
    setOpeningAppId(dashboardApp.id)
    try {
      const result = await ssoApi.launchApp(dashboardApp.id)
      if (popup) { popup.opener = null; popup.location.replace(result.redirectUrl) }
      else window.location.assign(result.redirectUrl)
    } catch (error) {
      popup?.close()
      message.error((error as Error).message)
    } finally { setOpeningAppId(null) }
  }
  const leave = async () => { await logout(); navigate('/login', { replace: true }) }
  return <div className="workbench">{settings.showWorkbenchHeader && <header className="workbench-header"><div className="workbench-header-brand"><img className="brand-mark small" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} /><strong>{settings.systemTitle}</strong></div><div className="header-actions">{user && can('platform.app.read') && <Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button>}{user ? <UserMenu user={user} onLogout={leave} /> : <Button type="primary" onClick={() => navigate('/login')}>登录</Button>}</div></header>}<section className="app-grid">
    {apps === null ? <Spin size="large" /> : apps.length ? apps.map((dashboardApp) => <button className="app-tile" key={dashboardApp.id} disabled={openingAppId === dashboardApp.id} onClick={() => { if (dashboardApp.outboundSsoConfigId && !user) { navigate('/login', { state: { from: '/' } }); return } void openApp(dashboardApp) }}><div className="app-icon">{openingAppId === dashboardApp.id ? <Spin /> : dashboardApp.imgThumbnail || dashboardApp.img ? <img src={dashboardApp.imgThumbnail || dashboardApp.img} alt="" /> : <span>{dashboardApp.name.slice(0, 1)}</span>}</div><div className="app-name">{dashboardApp.name}</div></button>) : <div className="workbench-empty"><Empty description="暂无可访问应用" /></div>}
  </section>{settings.footerRecord && <footer className="system-footer">{settings.footerRecord}</footer>}</div>
}
