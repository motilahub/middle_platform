import { useEffect, useState } from 'react'
import { App, Button, Checkbox, Form, Input, Spin, Typography, Upload } from 'antd'
import { DeleteOutlined, DownloadOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'
import { api } from '../../api'
import { useSystemSettings } from '../../system-settings'
import type { SystemSettings } from '../../types'
import { useAuth } from '../../auth'

export default function SystemSecurityConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const { update } = useSystemSettings()
  const [loading, setLoading] = useState(true)
  const [form] = Form.useForm<SystemSettings>()

  useEffect(() => {
    void (async () => {
      try { form.setFieldsValue(await api.adminSystemSettings()) }
      catch (error) { message.error((error as Error).message) }
      finally { setLoading(false) }
    })()
  }, [form, message])

  const selectImage = (field: 'systemLogo' | 'titleLogo') => (file: File) => {
    if (!file.type.startsWith('image/')) { message.error('请选择图片文件'); return Upload.LIST_IGNORE }
    if (file.size > 2 * 1024 * 1024) { message.error('图片不能超过 2MB'); return Upload.LIST_IGNORE }
    const reader = new FileReader()
    reader.onload = () => { form.setFieldValue(field, String(reader.result)); message.success('图片已选择，保存后生效') }
    reader.readAsDataURL(file)
    return false
  }
  const save = async (values: SystemSettings) => {
    try { const next = await api.updateSystemSettings(values); form.setFieldsValue(next); update(next); message.success('系统安全配置已保存') }
    catch (error) { message.error((error as Error).message) }
  }
  const downloadImage = (url: string, field: 'systemLogo' | 'titleLogo') => {
    const link = document.createElement('a')
    link.href = url
    link.download = field === 'systemLogo' ? 'system-logo' : 'title-logo'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
  const imageControl = (field: 'systemLogo' | 'titleLogo', label: string) => <Form.Item label={label} extra="支持 PNG、JPG、WebP 等图片格式，最大 2MB">
    <Form.Item noStyle shouldUpdate={(before, after) => before[field] !== after[field]}>{() => {
      const value = form.getFieldValue(field) as string | null | undefined
      return <Upload accept="image/*" beforeUpload={selectImage(field)} showUploadList={false}>{value ? <div className="image-upload-card"><img src={value} alt={label} /><div className="image-action image-download" title="下载图片" onClick={(event) => { event.preventDefault(); event.stopPropagation(); downloadImage(value, field) }}><DownloadOutlined /></div><div className="image-action image-delete" title="删除图片" onClick={(event) => { event.preventDefault(); event.stopPropagation(); form.setFieldValue(field, null) }}><DeleteOutlined /></div></div> : <div className="image-upload-card image-upload-empty" title="选择图片"><UploadOutlined /></div>}</Upload>
    }}</Form.Item>
    <Form.Item name={field} hidden><Input /></Form.Item>
  </Form.Item>

  if (loading) return <div className="route-loading"><Spin size="large" /></div>
  return <div>
    <div className="page-title"><div><Typography.Title level={3}>基础配置</Typography.Title><Typography.Text type="secondary">维护登录界面、浏览器标识和系统页脚信息</Typography.Text></div><Button type="primary" disabled={!can('platform.settings.write')} icon={<SaveOutlined />} onClick={() => form.submit()}>保存</Button></div>
    <Form form={form} layout="vertical" onFinish={(values) => void save(values)} className="system-settings-form">
      <Typography.Title level={5}>品牌标识</Typography.Title>
      <Form.Item name="systemTitle" label="系统标题" rules={[{ required: true, message: '请输入系统标题' }]}><Input maxLength={120} placeholder="集成平台" /></Form.Item>
      <Form.Item name="browserTitle" label="浏览器 Title" rules={[{ required: true, message: '请输入浏览器 Title' }]}><Input maxLength={120} placeholder="集成平台" /></Form.Item>
      {imageControl('systemLogo', '系统 Logo')}
      {imageControl('titleLogo', 'Title Logo')}
      <Typography.Title level={5}>登录与页脚</Typography.Title>
      <Form.Item name="loginText" label="登录界面文字"><Input maxLength={255} placeholder="控制台" /></Form.Item>
      <Form.Item name="footerRecord" label="页脚备案信息"><Input maxLength={255} placeholder="例如：京ICP备XXXXXXXX号" /></Form.Item>
      <Typography.Title level={5}>控制台管理</Typography.Title>
      <Form.Item name="showWorkbenchHeader" label="工作台 Header" valuePropName="checked" extra="开启后，工作台显示控制台、当前用户和退出入口"><Checkbox>显示 Header</Checkbox></Form.Item>
    </Form>
  </div>
}
