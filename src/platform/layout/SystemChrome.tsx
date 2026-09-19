import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { sanitizeHtml } from '../../shared/sanitize-html'
import { useSystemSettings } from '../../system-settings'
import UserMenu from '../identity/UserMenu'

export function SystemHeader() {
  const navigate = useNavigate()
  const { settings, defaultLogo } = useSystemSettings()
  const { user, loading, logout, can } = useAuth()
  if (!settings.showWorkbenchHeader) return null

  const leave = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return <header className="workbench-header">
    <button type="button" className="workbench-header-brand" onClick={() => navigate('/')} aria-label="返回工作台">
      <img className="brand-mark small" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} />
      <strong>{settings.systemTitle}</strong>
    </button>
    <div className="header-actions">
      {user && can('platform.app.read') && <Button type="text" onClick={() => navigate('/config/dashboard')}>控制台</Button>}
      {!loading && (user ? <UserMenu user={user} onLogout={leave} /> : <Button type="primary" onClick={() => navigate('/login')}>登录</Button>)}
    </div>
  </header>
}

export function SystemFooter() {
  const { settings } = useSystemSettings()
  if (!settings.footerRecord) return null
  return <footer className="system-footer" dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.footerRecord) }} />
}
