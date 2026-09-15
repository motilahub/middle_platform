import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useSystemSettings } from '../../system-settings'

export default function AiChatFloatingButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings, defaultLogo } = useSystemSettings()
  if (!user || location.pathname === '/ai-chat' || location.pathname === '/login') return null
  const icon = settings.aiChatRobotIcon || settings.systemLogo || defaultLogo
  return <button type="button" className="ai-chat-fab" onClick={() => navigate('/ai-chat')} aria-label="打开 AI 对话" title="打开 AI 对话"><img src={icon} alt="" /><span>AI</span></button>
}
