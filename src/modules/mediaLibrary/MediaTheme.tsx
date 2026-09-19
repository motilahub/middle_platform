import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Button, ConfigProvider, Tooltip, theme as antdTheme } from 'antd'
import { type ReactNode, useEffect, useState } from 'react'

const STORAGE_KEY = 'media-library-color-mode'

export function useMediaTheme() {
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = window.localStorage.getItem(STORAGE_KEY)
    if (savedMode) return savedMode === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  return { darkMode, setDarkMode }
}

export function MediaThemeProvider({ darkMode, children }: { darkMode: boolean; children: ReactNode }) {
  return <ConfigProvider theme={{
    algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: { colorPrimary: '#4f8cff', borderRadius: 8 },
  }}>{children}</ConfigProvider>
}

export function MediaThemeToggle({ darkMode, onChange }: { darkMode: boolean; onChange: (value: boolean) => void }) {
  const label = darkMode ? '切换为日间模式' : '切换为黑夜模式'
  return <Tooltip title={label}>
    <Button
      className="media-theme-toggle"
      type="text"
      shape="circle"
      icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
      aria-label={label}
      aria-pressed={darkMode}
      onClick={() => onChange(!darkMode)}
    />
  </Tooltip>
}
