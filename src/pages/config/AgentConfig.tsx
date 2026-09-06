import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAuth } from '../../auth'
import { aiApi } from '../../platform/ai-assistant/api'
import { modelProviderApi } from '../../platform/model-providers/api'
import type { AiAgent } from '../../platform/ai-assistant/types'
import type { ModelProvider } from '../../platform/model-providers/types'

type AgentForm = Pick<AiAgent, 'code' | 'name' | 'description' | 'modelProviderId' | 'model' | 'systemPrompt' | 'enabled' | 'isDefault'> & { settingsText?: string }

export default function AgentConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const [agents, setAgents] = useState<AiAgent[]>([])
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [selected, setSelected] = useState<AiAgent | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form] = Form.useForm<AgentForm>()
  const provider = Form.useWatch('modelProviderId', form)
  const availableModels = providers.find((item) => item.id === provider)?.models || []

  const load = async () => {
    setLoading(true)
    try { const [agentRows, providerRows] = await Promise.all([aiApi.adminAgents(), modelProviderApi.list()]); setAgents(agentRows); setProviders(providerRows) }
    catch (error) { message.error((error as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const create = () => { setSelected(null); form.resetFields(); form.setFieldsValue({ enabled: true, isDefault: false, systemPrompt: '你是一个可靠、清晰、简洁的助手。', settingsText: '{}' }); setOpen(true) }
  const edit = (agent: AiAgent) => { setSelected(agent); form.setFieldsValue({ ...agent, settingsText: JSON.stringify(agent.settings || {}, null, 2) }); setOpen(true) }
  const save = async (values: AgentForm) => {
    try { const { settingsText, ...agentValues } = values; const settings = JSON.parse(settingsText || '{}') as Record<string, unknown>; if (selected) await aiApi.updateAgent(selected.id, { ...agentValues, settings }); else await aiApi.createAgent({ ...agentValues, settings }); setOpen(false); await load(); message.success('保存成功') }
    catch (error) { message.error((error as Error).message) }
  }
  const remove = async (agent: AiAgent) => { try { await aiApi.deleteAgent(agent.id); await load(); message.success('已删除') } catch (error) { message.error((error as Error).message) } }
  const columns = useMemo(() => [
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '模型', render: (_: unknown, row: AiAgent) => `${providers.find((item) => item.id === row.modelProviderId)?.name || '未配置供应商'} / ${row.model || '默认模型'}`, width: 260 },
    { title: '状态', dataIndex: 'enabled', width: 90, render: (value: boolean) => value ? '启用' : '停用' },
    { title: '默认', dataIndex: 'isDefault', width: 80, render: (value: boolean) => value ? '是' : '否' },
    { title: '操作', width: 160, render: (_: unknown, row: AiAgent) => <Space>{can('platform.ai_agent.write') && <Button type="link" onClick={() => edit(row)}>编辑</Button>}{can('platform.ai_agent.unlink') && <Popconfirm title={row.isDefault ? '默认智能体不可删除' : '确认删除该智能体？'} onConfirm={() => void remove(row)} disabled={row.isDefault}><Button type="link" danger disabled={row.isDefault}>删除</Button></Popconfirm>}</Space> },
  ], [can, providers])

  return <div>
    <div className="page-title"><div><Typography.Title level={3}>智能体配置</Typography.Title><Typography.Text type="secondary">将模型、System Prompt 和通用参数封装为可选择的智能体</Typography.Text></div>{can('platform.ai_agent.create') && <Button type="primary" icon={<PlusOutlined />} onClick={create}>新建</Button>}</div>
    <Table className="config-table" loading={loading} rowKey="id" columns={columns} dataSource={agents} scroll={{ x: 900 }} pagination={false} />
    <Drawer title={selected ? '编辑智能体' : '新建智能体'} width={520} open={open} onClose={() => setOpen(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-z][a-z0-9_-]{2,79}$/, message: '使用 3-80 位小写字母、数字、下划线或短横线' }]}><Input disabled={!!selected} /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input maxLength={500} /></Form.Item>
        <Form.Item name="modelProviderId" label="模型供应商"><Select allowClear options={providers.filter((item) => item.enabled && item.hasApiKey).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
        <Form.Item name="model" label="具体模型"><Select allowClear showSearch options={availableModels.map((item) => ({ value: item, label: item }))} placeholder={availableModels.length ? '请选择模型' : '请先选择供应商'} /></Form.Item>
        <Form.Item name="systemPrompt" label="System Prompt" rules={[{ required: true, message: '请输入 System Prompt' }]}><Input.TextArea rows={8} maxLength={20000} showCount /></Form.Item>
        <Form.Item name="settingsText" label="通用配置（JSON）" extra="可配置 temperature、maxRounds 等模型通用参数" rules={[{ validator: (_rule, value?: string) => { try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('请输入 JSON 对象')) } catch { return Promise.reject(new Error('JSON 格式无效')) } } }]}><Input.TextArea rows={5} spellCheck={false} /></Form.Item>
        <Space size="large"><Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item><Form.Item name="isDefault" label="默认智能体" valuePropName="checked"><Switch disabled={selected?.isDefault} /></Form.Item></Space>
      </Form>
    </Drawer>
  </div>
}
