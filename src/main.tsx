import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'antd/dist/reset.css'
import './styles.css'
import App from './App'
import { AuthProvider } from './auth'
import { SystemSettingsProvider } from './system-settings'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SystemSettingsProvider><AuthProvider><App /></AuthProvider></SystemSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
