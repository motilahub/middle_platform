import { Button, Empty, Spin, Typography } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { DashboardApp } from '../types'
import { useSystemSettings } from '../system-settings'
import { useAuth } from '../auth'

export default function Workbench() {
  const [apps, setApps] = useState<DashboardApp[] | null>(null)
  const { settings, defaultLogo } = useSystemSettings()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { api.visibleApps().then(setApps) }, [])
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  const leave = async () => { await logout(); navigate('/login', { replace: true }) }
  return <div className="workbench">{settings.showWorkbenchHeader && <header className="workbench-header"><div className="workbench-header-brand"><img className="brand-mark small" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} /><strong>{settings.systemTitle}</strong></div><div className="header-actions">{user!.role !== 'user' && <Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button>}<Typography.Text>{user!.name}</Typography.Text><Button type="text" icon={<LogoutOutlined />} onClick={() => void leave()}>退出</Button></div></header>}<section className="app-grid">
    {apps === null ? <Spin size="large" /> : apps.length ? apps.map((app) => <button className="app-tile" key={app.id} onClick={() => open(app.url)}><div className="app-icon">{app.imgThumbnail || app.img ? <img src={app.imgThumbnail || app.img} alt="" /> : <span>{app.name.slice(0, 1)}</span>}</div><div className="app-name">{app.name}</div></button>) : <Empty description="暂无可访问应用" />}
  </section>{settings.footerRecord && <footer className="system-footer">{settings.footerRecord}</footer>}</div>
}
