import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Typography, message } from 'antd'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSystemSettings } from '../system-settings'
import { useAuth } from '../auth'

type Values = { name: string; login: string; email: string; phone?: string; password: string; confirm: string; code: string }

export default function AuthAccount({ mode }: { mode: 'register' | 'reset' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings, defaultLogo } = useSystemSettings()
  const [form] = Form.useForm<Values>()
  const [seconds, setSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => { if (mode === 'register') void api.authOptions().then(({ registrationEnabled }) => setEnabled(registrationEnabled)).catch(() => setEnabled(false)) }, [mode])
  useEffect(() => { if (!seconds) return; const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000); return () => window.clearTimeout(timer) }, [seconds])
  if (user) return <Navigate to="/" replace />
  if (mode === 'register' && enabled === false) return <Navigate to="/login" replace />
  const send = async () => {
    try {
      await form.validateFields(['email'])
      setSending(true)
      const result = await api.sendAuthCode(mode, form.getFieldValue('email'))
      message.success(result.message)
      setSeconds(60)
    } catch (error) { if (error instanceof Error) message.error(error.message) }
    finally { setSending(false) }
  }
  const submit = async (values: Values) => {
    setSubmitting(true)
    try {
      if (mode === 'register') await api.register(values)
      else await api.resetPassword({ email: values.email, code: values.code, password: values.password })
      message.success(mode === 'register' ? '注册成功，请登录' : '密码已更新，请重新登录')
      navigate('/login', { replace: true })
    } catch (error) { message.error((error as Error).message) }
    finally { setSubmitting(false) }
  }
  return <main className="login-page"><Card className="login-card auth-account-card" bordered={false}>
    <img className="brand-mark" src={settings.systemLogo || defaultLogo} alt={settings.systemTitle} />
    <Typography.Title level={3}>{mode === 'register' ? '注册账号' : '找回密码'}</Typography.Title>
    <Form form={form} layout="vertical" className="login-form" onFinish={(values) => void submit(values)} autoComplete="off">
      {mode === 'register' && <>
        <Form.Item name="name" label="昵称" rules={[{ required: true, max: 120 }]}><Input maxLength={120} autoComplete="nickname" /></Form.Item>
        <Form.Item name="login" label="登录名" rules={[{ required: true }, { pattern: /^[a-zA-Z][a-zA-Z0-9_-]{2,79}$/, message: '3-80 位字母、数字、下划线或短横线，以字母开头' }]}><Input autoComplete="username" /></Form.Item>
      </>}
      <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input autoComplete="email" /></Form.Item>
      {mode === 'register' && <Form.Item name="phone" label="手机号（选填）"><Input autoComplete="tel" /></Form.Item>}
      <Form.Item label="邮箱验证码" required><div className="auth-code-row"><Form.Item name="code" noStyle rules={[{ required: true, pattern: /^\d{6}$/, message: '请输入 6 位验证码' }]}><Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></Form.Item><Button disabled={seconds > 0} loading={sending} onClick={() => void send()}>{seconds ? `${seconds}秒后重发` : '发送验证码'}</Button></div></Form.Item>
      <Form.Item name="password" label="新密码" rules={[{ required: true }]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item name="confirm" label="确认密码" dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) => value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')) })]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Button type="primary" htmlType="submit" block loading={submitting}>{mode === 'register' ? '注册' : '重置密码'}</Button>
    </Form>
    <div className="auth-links"><Link to="/login">返回登录</Link></div>
  </Card></main>
}
