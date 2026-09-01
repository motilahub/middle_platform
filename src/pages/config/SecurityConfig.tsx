import { useEffect, useState } from 'react'
import { App, Button, Checkbox, Form, InputNumber, Spin, Typography } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { api } from '../../api'
import type { SecuritySettings } from '../../types'

export default function SecurityConfig() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [form] = Form.useForm<SecuritySettings>()

  useEffect(() => {
    void (async () => {
      try { form.setFieldsValue(await api.adminSecuritySettings()) }
      catch (error) { message.error((error as Error).message) }
      finally { setLoading(false) }
    })()
  }, [form, message])

  const save = async (values: SecuritySettings) => {
    try { form.setFieldsValue(await api.updateSecuritySettings(values)); message.success('系统安全配置已保存') }
    catch (error) { message.error((error as Error).message) }
  }

  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  return <div>
    <div className="page-title"><div><Typography.Title level={3}>系统安全</Typography.Title><Typography.Text type="secondary">维护接口访问频率与用户密码强度策略</Typography.Text></div><Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>保存</Button></div>
    <Form form={form} layout="vertical" onFinish={(values) => void save(values)} className="security-settings-form">
      <Typography.Title level={5}>接口频率限制</Typography.Title>
      <div className="security-setting-panel security-rate-panel"><Form.Item name="apiRateLimitPerMinute" label="每分钟接口请求次数" extra="按访问 IP 在滚动 60 秒内统计，超过限制会返回 429" rules={[{ required: true, message: '请输入每分钟请求次数' }]}><InputNumber min={1} max={10000} precision={0} style={{ width: '100%' }} addonAfter="次" /></Form.Item></div>
      <Typography.Title level={5}>用户密码强度</Typography.Title>
      <div className="security-setting-panel security-password-panel"><Form.Item name="passwordMinLength" label="密码最小长度" extra="仅在创建用户或修改密码时校验" rules={[{ required: true, message: '请输入密码最小长度' }]}><InputNumber min={6} max={128} precision={0} style={{ width: '100%' }} addonAfter="位" /></Form.Item><Form.Item label="密码组成" extra="至少启用一种组合规则"><div className="password-rule-list"><Form.Item name="passwordRequireUppercase" valuePropName="checked" noStyle><Checkbox>大写字母 A-Z</Checkbox></Form.Item><Form.Item name="passwordRequireLowercase" valuePropName="checked" noStyle><Checkbox>小写字母 a-z</Checkbox></Form.Item><Form.Item name="passwordRequireNumber" valuePropName="checked" noStyle><Checkbox>数字 0-9</Checkbox></Form.Item><Form.Item name="passwordRequireSpecial" valuePropName="checked" noStyle><Checkbox>特殊符号</Checkbox></Form.Item></div></Form.Item></div>
    </Form>
  </div>
}
