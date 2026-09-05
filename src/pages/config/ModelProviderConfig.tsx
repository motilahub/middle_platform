import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import { ApiOutlined, CloudSyncOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useAuth } from '../../auth'
import { modelProviderApi } from '../../platform/model-providers/api'
import type { ModelProvider, ModelVendor } from '../../platform/model-providers/types'

type FormValues = Omit<ModelProvider, 'id' | 'hasApiKey' | 'models' | 'createdAt' | 'updatedAt'>

const vendors: Array<{ value: ModelVendor; label: string; baseUrl?: string }> = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { value: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'zhipu', label: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { value: 'moonshot', label: 'Moonshot AI', baseUrl: 'https://api.moonshot.cn/v1' },
  { value: 'custom', label: '自定义（OpenAI 兼容）' },
]

const vendorLabel = (vendor: ModelVendor) => vendors.find((item) => item.value === vendor)?.label || vendor

export default function ModelProviderConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const [rows, setRows] = useState<ModelProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ModelProvider | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [checked, setChecked] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [page, setPage] = useState({ current: 1, pageSize: 10 })
  const [form] = Form.useForm<FormValues>()
  const vendor = Form.useWatch('vendor', form)
  const availableModels = selected?.models || []

  const load = async () => {
    setLoading(true)
    try { setRows(await modelProviderApi.list()) } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const openCreate = () => {
    setSelected(null)
    form.resetFields()
    form.setFieldsValue({ vendor: 'openai', baseUrl: vendors[0].baseUrl, enabled: true })
    setDrawer(true)
  }
  const openEdit = (row: ModelProvider) => {
    setSelected(row)
    form.setFieldsValue({ ...row, apiKey: undefined })
    setDrawer(true)
  }
  const setVendor = (nextVendor: ModelVendor) => {
    const preset = vendors.find((item) => item.value === nextVendor)
    form.setFieldValue('baseUrl', preset?.baseUrl || '')
  }
  const save = async (values: FormValues) => {
    try {
      if (selected) await modelProviderApi.update(selected.id, values)
      else await modelProviderApi.create(values)
      setDrawer(false)
      await load()
      message.success('保存成功')
    } catch (error) { message.error((error as Error).message) }
  }
  const test = async (id: number) => {
    setBusyId(id)
    try { message.success((await modelProviderApi.test(id)).message) } catch (error) { message.error((error as Error).message) } finally { setBusyId(null) }
  }
  const syncModels = async (id: number) => {
    setBusyId(id)
    try { const result = await modelProviderApi.syncModels(id); await load(); message.success(`已获取 ${result.models.length} 个模型`) } catch (error) { message.error((error as Error).message) } finally { setBusyId(null) }
  }
  const toggle = async (row: ModelProvider, enabled: boolean) => {
    const previous = rows
    setRows((items) => items.map((item) => item.id === row.id ? { ...item, enabled } : item))
    try { await modelProviderApi.toggle(row.id, enabled); message.success(enabled ? '已启用' : '已停用') } catch (error) { setRows(previous); message.error((error as Error).message) }
  }
  const remove = async (id: number) => {
    try { await modelProviderApi.delete(id); setChecked((ids) => ids.filter((value) => value !== id)); await load(); message.success('已删除') } catch (error) { message.error((error as Error).message) }
  }
  const batchDelete = async () => {
    try { await modelProviderApi.deleteMany(checked); setChecked([]); await load(); message.success('已删除选中记录') } catch (error) { message.error((error as Error).message) }
  }

  const columns = useMemo(() => [
    { title: '序号', width: 70, render: (_: unknown, __: ModelProvider, index: number) => (page.current - 1) * page.pageSize + index + 1 },
    { title: '编码', dataIndex: 'code', width: 150 },
    { title: '名称', dataIndex: 'name', width: 170 },
    { title: '厂商', dataIndex: 'vendor', width: 150, render: (value: ModelVendor) => vendorLabel(value) },
    { title: '服务地址', dataIndex: 'baseUrl', width: 280, ellipsis: true },
    { title: '默认模型', dataIndex: 'defaultModel', width: 180, render: (value?: string) => value || '-' },
    { title: '已获取模型', dataIndex: 'models', width: 120, render: (models: string[]) => <Tag>{models.length}</Tag> },
    { title: '凭据', dataIndex: 'hasApiKey', width: 90, render: (hasApiKey: boolean) => hasApiKey ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag> },
    { title: '状态', dataIndex: 'enabled', width: 80, render: (enabled: boolean, row: ModelProvider) => <Switch size="small" checked={enabled} disabled={!can('platform.model_provider.write')} onChange={(value) => void toggle(row, value)} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
    { title: '操作', width: 190, fixed: 'right' as const, render: (_: unknown, row: ModelProvider) => <Space size={0}>{can('platform.model_provider.read') && <Tooltip title="测试连接"><Button type="link" icon={<ApiOutlined />} loading={busyId === row.id} onClick={() => void test(row.id)} /></Tooltip>}{can('platform.model_provider.write') && <Tooltip title="获取模型"><Button type="link" icon={<CloudSyncOutlined />} loading={busyId === row.id} onClick={() => void syncModels(row.id)} /></Tooltip>}{can('platform.model_provider.write') && <Button type="link" onClick={() => openEdit(row)}>编辑</Button>}{can('platform.model_provider.unlink') && <Popconfirm title="确认删除该供应商？" onConfirm={() => void remove(row.id)}><Button type="link" danger>删除</Button></Popconfirm>}</Space> },
  ], [busyId, can, page, rows])
  const filteredRows = rows.filter((row) => `${row.code} ${row.name} ${vendorLabel(row.vendor)} ${row.baseUrl}`.toLowerCase().includes(keyword.trim().toLowerCase()))

  return <div>
    <div className="page-title"><div><Typography.Title level={3}>模型供应商</Typography.Title><Typography.Text type="secondary">维护大模型服务连接、可用模型和默认模型</Typography.Text></div><Space>{can('platform.model_provider.unlink') && <Button danger icon={<DeleteOutlined />} disabled={!checked.length} onClick={() => void batchDelete()}>删除选中</Button>}{can('platform.model_provider.create') && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建</Button>}</Space></div>
    <Input.Search className="list-filter" allowClear placeholder="筛选编码、名称、厂商或服务地址" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage((value) => ({ ...value, current: 1 })) }} />
    <Table loading={loading} rowKey="id" columns={columns} dataSource={filteredRows} scroll={{ x: 1700 }} rowSelection={{ selectedRowKeys: checked, preserveSelectedRowKeys: true, onChange: (keys) => setChecked(keys as number[]) }} pagination={{ current: page.current, pageSize: page.pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 条`, onChange: (current, pageSize) => setPage({ current, pageSize }) }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover,.ant-switch,.ant-checkbox-wrapper')) return; openEdit(record) } })} />
    <Drawer title={selected ? '编辑模型供应商' : '新建模型供应商'} width={520} open={drawer} onClose={() => setDrawer(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-z][a-z0-9_-]{2,79}$/, message: '使用 3-80 位小写字母、数字、下划线或短横线' }]}><Input disabled={!!selected} placeholder="例如 openai_main" /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="例如 OpenAI 主账号" /></Form.Item>
        <Form.Item name="vendor" label="厂商" rules={[{ required: true, message: '请选择厂商' }]}><Select options={vendors.map(({ value, label }) => ({ value, label }))} onChange={setVendor} /></Form.Item>
        <Form.Item name="baseUrl" label="服务地址" rules={[{ required: true, message: '请输入服务地址' }, { type: 'url', message: '请输入有效 URL' }]} extra={vendor === 'custom' ? '仅允许公网 HTTPS 地址，并要求兼容 OpenAI /models 接口' : undefined}><Input disabled={vendor !== 'custom'} placeholder="https://api.example.com/v1" /></Form.Item>
        <Form.Item name="apiKey" label="API Key" extra={selected?.hasApiKey ? '已加密保存；留空表示不更换' : undefined} rules={[{ required: !selected, message: '请输入 API Key' }]}><Input.Password autoComplete="new-password" placeholder={selected?.hasApiKey ? '留空表示不更换' : '请输入 API Key'} /></Form.Item>
        <Form.Item name="defaultModel" label="默认模型"><Select allowClear showSearch optionFilterProp="label" options={availableModels.map((model) => ({ value: model, label: model }))} placeholder={availableModels.length ? '请选择已获取模型' : '请先保存后获取模型'} /></Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Drawer>
  </div>
}
