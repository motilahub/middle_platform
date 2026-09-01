import { Form, Input, Button, Card, Typography, message } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import logo from '../images/logo.png'

function ssoRedirectPath(redirectUrl?: string) {
  if (!redirectUrl) return '/'
  try {
    const target = new URL(redirectUrl, window.location.origin)
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/'
  } catch { return '/' }
}

export default function Login() {
  const navigate = useNavigate(); const location = useLocation()
  const { user, refresh, logout } = useAuth()
  const [form] = Form.useForm<{ code: string; password: string }>()
  const handledSsoAttempt = useRef<string | null>(null)
  useEffect(() => {
    const ticket = new URLSearchParams(location.search).get('ticket')
    const ssoCode = new URLSearchParams(location.search).get('ssoCode')
    if (!ticket) return
    const attemptKey = `${ssoCode || ''}:${ticket}`
    if (handledSsoAttempt.current === attemptKey) return
    handledSsoAttempt.current = attemptKey
    void (async () => {
      // An SSO failure must not fall back to a previously authenticated browser session.
      await logout()
      if (!ssoCode) { message.error('未指定外部访入配置'); return }
      try {
        const result = await api.exchangeSsoTicket(ssoCode, ticket)
        await refresh()
        navigate(ssoRedirectPath(result.redirectUrl), { replace: true })
      } catch (error) { message.error((error as Error).message) }
    })()
  }, [location.search, logout, navigate, refresh])
  const isSsoAttempt = Boolean(new URLSearchParams(location.search).get('ticket'))
  useEffect(() => { if (user && !isSsoAttempt) navigate('/', { replace: true }) }, [user, isSsoAttempt, navigate])
  const submit = async (values: { code: string; password: string }) => {
    try { await api.login(values.code, values.password); await refresh(); const from = (location.state as { from?: string } | null)?.from || '/'; navigate(from, { replace: true }) }
    catch (error) { message.error((error as Error).message) }
  }
  return <main className="login-page"><Card className="login-card" bordered={false}>
    <img className="brand-mark" src={logo} alt="AI财务助手" /><Typography.Title level={2}>AI财务助手</Typography.Title><Typography.Text type="secondary">后台配置系统</Typography.Text>
    <Form form={form} layout="vertical" onFinish={submit} className="login-form">
      <Form.Item name="code" rules={[{ required: true, message: '请输入账号' }]}><Input size="large" prefix={<UserOutlined />} placeholder="账号" /></Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}><Input.Password size="large" prefix={<LockOutlined />} placeholder="密码" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block>登录</Button>
    </Form>
  </Card></main>
}
