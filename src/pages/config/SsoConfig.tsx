import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../../api'
import { SsoConfig as SsoConfigType, SsoDirection, SsoProtocol } from '../../types'

type FormValues = Omit<SsoConfigType, 'id' | 'direction' | 'createdAt' | 'updatedAt'>

const protocolLabels: Record<SsoProtocol, string> = { oidc: 'OIDC', cas: 'CAS', ticket: 'Ticket', saml: 'SAML' }
const callbackUrlRule = {
  validator: (_: unknown, value?: string) => {
    if (!value || (value.startsWith('/') && !value.startsWith('//'))) return Promise.resolve()
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') return Promise.resolve()
    } catch { /* Validation error is returned below. */ }
    return Promise.reject(new Error('请输入以 / 开头的系统内路径或有效 URL'))
  },
}

export default function SsoConfig({ direction }: { direction: SsoDirection }) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<SsoConfigType[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SsoConfigType | null>(null)
  const [checked, setChecked] = useState<number[]>([])
  const [drawer, setDrawer] = useState(false)
  const [page, setPage] = useState({ current: 1, pageSize: 10 })
  const [form] = Form.useForm<FormValues>()
  const inbound = direction === 'inbound'
  const title = inbound ? '外部访入' : '内部访出'
  const protocol = Form.useWatch('protocol', form) || 'ticket'
  const systemUrlLabel = protocol === 'cas' ? 'CAS 服务地址' : protocol === 'oidc' || protocol === 'saml' ? '身份提供方地址' : inbound ? '认证系统地址' : '目标系统地址'

  const load = async () => {
    setLoading(true)
    try { setRows(await api.ssoConfigs(direction)) } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [direction])
  const openCreate = () => { setSelected(null); form.resetFields(); form.setFieldsValue({ protocol: 'ticket', enabled: true, priority: rows.length + 1, userIdentifier: 'userId' }); setDrawer(true) }
  const openEdit = (row: SsoConfigType) => { setSelected(row); form.setFieldsValue(row); setDrawer(true) }
  const save = async (values: FormValues) => {
    try {
      if (selected) await api.updateSsoConfig(direction, selected.id, values)
      else await api.createSsoConfig(direction, values)
      setDrawer(false); await load(); message.success('保存成功')
    } catch (error) { message.error((error as Error).message) }
  }
  const remove = async (id: number) => { try { await api.deleteSsoConfig(direction, id); setChecked((ids) => ids.filter((item) => item !== id)); await load(); message.success('已删除') } catch (error) { message.error((error as Error).message) } }
  const batchDelete = async () => { try { await api.deleteSsoConfigs(direction, checked); setChecked([]); await load(); message.success('已删除选中记录') } catch (error) { message.error((error as Error).message) } }
  const toggle = async (row: SsoConfigType, enabled: boolean) => {
    const previous = rows; setRows((items) => items.map((item) => item.id === row.id ? { ...item, enabled } : item))
    try { await api.toggleSsoConfig(direction, row.id, enabled); message.success(enabled ? '已启用' : '已停用') } catch (error) { setRows(previous); message.error((error as Error).message) }
  }
  const columns = useMemo(() => [
    { title: '序号', width: 70, render: (_: unknown, __: SsoConfigType, index: number) => (page.current - 1) * page.pageSize + index + 1 },
    { title: '编码', dataIndex: 'code', width: 150 },
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '协议', dataIndex: 'protocol', width: 100, render: (protocol: SsoProtocol) => protocolLabels[protocol] },
    { title: '系统地址', dataIndex: 'systemUrl', width: 240, ellipsis: true },
    { title: '校验地址', dataIndex: 'verifyUrl', width: 240, ellipsis: true, render: (value?: string) => value || '-' },
    { title: '状态', dataIndex: 'enabled', width: 80, render: (enabled: boolean, row: SsoConfigType) => <Switch size="small" checked={enabled} onChange={(value) => void toggle(row, value)} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
    { title: '操作', width: 150, render: (_: unknown, row: SsoConfigType) => <Space><Button type="link" onClick={() => openEdit(row)}>编辑</Button><Popconfirm title="确认删除该配置？" onConfirm={() => void remove(row.id)}><Button type="link" danger>删除</Button></Popconfirm></Space> },
  ], [page, rows])

  return <div>
    <div className="page-title"><div><Typography.Title level={3}>{title}</Typography.Title><Typography.Text type="secondary">{inbound ? '配置其他系统进入本系统的单点登录方式' : '配置从本系统进入其他业务系统的单点登录方式'}</Typography.Text></div><Space><Button danger icon={<DeleteOutlined />} disabled={!checked.length} onClick={() => void batchDelete()}>删除选中</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建</Button></Space></div>
    <Table loading={loading} rowKey="id" columns={columns} dataSource={rows} scroll={{ x: 1300 }} rowSelection={{ selectedRowKeys: checked, preserveSelectedRowKeys: true, onChange: (keys) => setChecked(keys as number[]) }} pagination={{ current: page.current, pageSize: page.pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 条`, onChange: (current, pageSize) => setPage({ current, pageSize }) }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover,.ant-switch,.ant-checkbox-wrapper')) return; openEdit(record) } })} />
    <Drawer title={selected ? `编辑${title}` : `新建${title}`} width={520} open={drawer} onClose={() => setDrawer(false)} afterOpenChange={(open) => { if (open && selected) form.setFieldsValue(selected) }} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}><Input placeholder="例如 oa_main" disabled={!!selected} /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="例如 总部 OA" /></Form.Item>
        <Form.Item name="protocol" label="协议" rules={[{ required: true, message: '请选择协议' }]}><Select options={Object.entries(protocolLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="systemUrl" label={systemUrlLabel} rules={[{ required: true, message: '请输入系统地址' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item>
        {protocol === 'ticket' && <><Form.Item preserve={false} name="verifyUrl" label={inbound ? '校验地址' : 'Ticket 签发地址'} rules={[{ required: inbound, message: '外部访入必须填写校验地址' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item>{inbound && <Form.Item preserve={false} name="callbackUrl" label="登录成功跳转地址" rules={[callbackUrlRule]}><Input placeholder="/config/dashboard 或 https://" /></Form.Item>}</>}
        {protocol === 'cas' && <><Form.Item preserve={false} name="verifyUrl" label="Ticket 校验地址" rules={[{ required: true, message: '请输入 Ticket 校验地址' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item><Form.Item preserve={false} name="callbackUrl" label="服务回调地址" rules={[{ required: true, message: '请输入服务回调地址' }, callbackUrlRule]}><Input placeholder="/ 或 https://" /></Form.Item></>}
        {protocol === 'oidc' && <><Form.Item preserve={false} name="issuer" label="Issuer" rules={[{ required: true, message: '请输入 Issuer' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://issuer.example.com" /></Form.Item><Form.Item preserve={false} name="authorizeUrl" label="授权地址" rules={[{ required: true, message: '请输入授权地址' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item><Form.Item preserve={false} name="verifyUrl" label="Token / 用户信息地址" rules={[{ type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item><Form.Item preserve={false} name="callbackUrl" label="回调地址" rules={[{ required: true, message: '请输入回调地址' }, callbackUrlRule]}><Input placeholder="/ 或 https://" /></Form.Item><Form.Item preserve={false} name="clientId" label="Client ID" rules={[{ required: true, message: '请输入 Client ID' }]}><Input /></Form.Item></>}
        {protocol === 'saml' && <><Form.Item preserve={false} name="issuer" label="IdP Issuer" rules={[{ required: true, message: '请输入 IdP Issuer' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://idp.example.com" /></Form.Item><Form.Item preserve={false} name="verifyUrl" label="SAML 元数据 / 校验地址" rules={[{ required: true, message: '请输入 SAML 元数据或校验地址' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://" /></Form.Item><Form.Item preserve={false} name="callbackUrl" label="断言消费地址（ACS）" rules={[{ required: true, message: '请输入断言消费地址' }, callbackUrlRule]}><Input placeholder="/ 或 https://" /></Form.Item></>}
        <Form.Item name="userIdentifier" label="用户标识字段"><Input placeholder="userId" /></Form.Item>
        <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Drawer>
  </div>
}
