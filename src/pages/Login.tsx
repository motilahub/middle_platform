import { Form, Input, Button, Card, Typography, message } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import logo from '../images/logo.png'

export default function Login() {
  const navigate = useNavigate(); const location = useLocation()
  const { user, refresh } = useAuth()
  const [form] = Form.useForm<{ code: string; password: string }>()
  useEffect(() => {
    const ticket = new URLSearchParams(location.search).get('ticket')
    if (!ticket) return
    api.exchangeOaTicket(ticket)
      .then(async () => { await refresh(); navigate('/', { replace: true }) })
      .catch(() => message.error('OA 登录凭证无效或已过期'))
  }, [location.search, navigate])
  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])
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
