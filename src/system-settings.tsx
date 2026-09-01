import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { SystemSettings } from './types'
import defaultLogo from './images/logo.png'

const defaults: SystemSettings = {
  systemTitle: 'AI财务助手',
  browserTitle: 'AI财务助手',
  loginText: '后台配置系统',
  showWorkbenchHeader: true,
}
interface SystemSettingsValue { settings: SystemSettings; refresh: () => Promise<void>; update: (settings: SystemSettings) => void; defaultLogo: string }
const SystemSettingsContext = createContext<SystemSettingsValue | null>(null)

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaults)
  const refresh = async () => { try { setSettings({ ...defaults, ...await api.systemSettings() }) } catch { setSettings(defaults) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    document.title = settings.browserTitle || settings.systemTitle
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon) }
    icon.href = settings.titleLogo || defaultLogo
  }, [settings.browserTitle, settings.systemTitle, settings.titleLogo])
  return <SystemSettingsContext.Provider value={{ settings, refresh, update: setSettings, defaultLogo }}>{children}</SystemSettingsContext.Provider>
}

export const useSystemSettings = () => useContext(SystemSettingsContext)!
