import { App, Button, Empty, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DashboardApp } from '../types'
import { ssoApi } from '../platform/sso/api'
import { useSystemSettings } from '../system-settings'
import { useAuth } from '../auth'
import UserMenu from '../platform/identity/UserMenu'
import { sanitizeHtml } from '../shared/sanitize-html'

type AppGroup = { key: string; id?: number; name: string; priority?: number; apps: DashboardApp[] }

function groupApps(apps: DashboardApp[]): AppGroup[] {
  const groups = new Map<string, AppGroup>()
  apps.forEach((app) => {
    const key = app.categoryId ? String(app.categoryId) : 'uncategorized'
    const group = groups.get(key) || { key, id: app.categoryId, name: app.categoryName || '未分类', priority: app.categoryPriority, apps: [] }
    group.apps.push(app)
    groups.set(key, group)
  })
  return [...groups.values()].map((group) => ({ ...group, apps: group.apps.sort((a, b) => a.priority - b.priority || a.id - b.id) })).sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))
}

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
  const groups = apps ? groupApps(apps) : []
  const renderApp = (dashboardApp: DashboardApp) => <button className="app-tile" key={dashboardApp.id} disabled={openingAppId === dashboardApp.id} onClick={() => { if (dashboardApp.outboundSsoConfigId && !user) { navigate('/login', { state: { from: '/' } }); return } void openApp(dashboardApp) }}><div className="app-icon">{openingAppId === dashboardApp.id ? <Spin /> : dashboardApp.imgThumbnail || dashboardApp.img ? <img src={dashboardApp.imgThumbnail || dashboardApp.img} alt="" /> : <span>{dashboardApp.name.slice(0, 1)}</span>}</div><div className="app-name">{dashboardApp.name}</div></button>
  return <div className="workbench">{settings.showWorkbenchHeader && <header className="workbench-header"><button type="button" className="workbench-header-brand" onClick={() => navigate('/')} aria-label="返回首页"><img className="brand-mark small" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} /><strong>{settings.systemTitle}</strong></button><div className="header-actions">{user && can('platform.app.read') && <Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button>}{user ? <UserMenu user={user} onLogout={leave} /> : <Button type="primary" onClick={() => navigate('/login')}>登录</Button>}</div></header>}<section className="app-grid">
    {apps === null ? <Spin size="large" /> : groups.length ? groups.map((group) => <section className="workbench-category" key={group.key}><h2 className="workbench-category-title">{group.name}</h2><div className="workbench-category-grid">{group.apps.map(renderApp)}</div></section>) : <div className="workbench-empty"><Empty description="暂无可访问应用" /></div>}
  </section>{settings.footerRecord && <footer className="system-footer" dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.footerRecord) }} />}</div>
}
