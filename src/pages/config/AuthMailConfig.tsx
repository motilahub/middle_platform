import { useEffect, useState } from 'react'
import { App, Button, Descriptions, Drawer, Form, Input, InputNumber, Spin, Switch, Typography } from 'antd'
import { api, type AuthMailSettings } from '../../api'
import { useAuth } from '../../auth'

type Values = AuthMailSettings & { smtpPassword?: string }

export default function AuthMailConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const [form] = Form.useForm<Values>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [settings, setSettings] = useState<AuthMailSettings | null>(null)
  useEffect(() => { void api.authMailSettings().then((value) => { setSettings(value); form.setFieldsValue(value) }).catch((error: Error) => message.error(error.message)).finally(() => setLoading(false)) }, [form, message])
  const save = async (values: Values) => {
    setBusy(true)
    try { const next = await api.updateAuthMailSettings(values); setSettings(next); form.setFieldsValue({ ...next, smtpPassword: '' }); setEditing(false); message.success('邮件服务配置已保存') }
    catch (error) { message.error((error as Error).message) }
    finally { setBusy(false) }
  }
  const test = async () => {
    try {
      const email = settings?.senderEmail
      if (!email) { message.warning('请先填写发件邮箱并保存配置'); return }
      await api.testAuthMail(email)
      message.success('测试邮件已发送至发件邮箱')
    } catch (error) { message.error((error as Error).message) }
  }
  if (loading) return <div className="route-loading"><Spin /></div>
  return <div><div className="page-title"><div><Typography.Title level={3}>邮件与注册</Typography.Title></div><Button type="primary" disabled={!can('platform.settings.write')} onClick={() => setEditing(true)}>编辑</Button></div>
    <Descriptions bordered size="middle" column={{ xs: 1, sm: 2 }}>
      <Descriptions.Item label="自助注册">{settings?.registrationEnabled ? '已开启' : '已关闭'}</Descriptions.Item>
      <Descriptions.Item label="密码">{settings?.hasPassword ? '已配置' : '未配置'}</Descriptions.Item>
      <Descriptions.Item label="SMTP 服务器">{settings?.smtpHost || '-'}</Descriptions.Item>
      <Descriptions.Item label="端口">{settings?.smtpPort || '-'}</Descriptions.Item>
      <Descriptions.Item label="SMTP 账号">{settings?.smtpUser || '-'}</Descriptions.Item>
      <Descriptions.Item label="发件邮箱">{settings?.senderEmail || '-'}</Descriptions.Item>
      <Descriptions.Item label="连接方式">{settings?.smtpSecure ? 'SSL/TLS' : 'STARTTLS'}</Descriptions.Item>
      <Descriptions.Item label="验证码">5 分钟有效，最多验证 3 次</Descriptions.Item>
    </Descriptions>
    <div className="auth-mail-actions"><Button disabled={!can('platform.settings.write') || !settings?.hasPassword} onClick={() => void test()}>发送测试邮件</Button></div>
    <Drawer title="编辑邮件与注册" width={520} open={editing} destroyOnClose onClose={() => { setEditing(false); if (settings) form.setFieldsValue({ ...settings, smtpPassword: '' }) }} extra={<Button type="primary" loading={busy} onClick={() => form.submit()}>保存</Button>}>
    <Form form={form} className="auth-settings-form" layout="vertical" onFinish={(values) => void save(values)}>
      <Form.Item name="registrationEnabled" label="开放自助注册" valuePropName="checked"><Switch disabled={!can('platform.settings.write')} /></Form.Item>
      <div className="auth-settings-grid">
        <Form.Item name="smtpHost" label="SMTP 服务器" rules={[{ required: true }]}><Input placeholder="smtp.example.com" /></Form.Item>
        <Form.Item name="smtpPort" label="端口" rules={[{ required: true }]}><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="smtpUser" label="SMTP 账号" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="smtpPassword" label="SMTP 密码" extra="留空保持原密码；保存后不会回显"><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="senderEmail" label="发件邮箱" rules={[{ required: true, type: 'email' }]}><Input type="email" /></Form.Item>
        <Form.Item name="smtpSecure" label="SSL/TLS（关闭时强制 STARTTLS）" valuePropName="checked"><Switch /></Form.Item>
      </div>
      <Typography.Text type="secondary">重新发送验证码后，旧验证码立即失效。</Typography.Text>
    </Form></Drawer>
  </div>
}
