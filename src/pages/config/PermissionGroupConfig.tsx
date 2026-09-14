import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../../api'
import type { PermissionDefinition, PermissionGroup } from '../../types'
import { useAuth } from '../../auth'

type GroupForm = Omit<PermissionGroup, 'id'>

export default function PermissionGroupConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [definitions, setDefinitions] = useState<PermissionDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PermissionGroup | null>(null)
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [form] = Form.useForm<GroupForm>()

  const load = async () => {
    setLoading(true)
    try {
      const [groupRows, permissionRows] = await Promise.all([api.permissionGroups(), api.permissionDefinitions()])
      setGroups(groupRows)
      setDefinitions(permissionRows)
    } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const create = () => {
    setSelected(null)
    form.resetFields()
    form.setFieldsValue({ permissions: [], impliedGroupIds: [] })
    setOpen(true)
  }
  const edit = (group: PermissionGroup) => {
    setSelected(group)
    form.setFieldsValue({ ...group, impliedGroupIds: group.impliedGroupIds || [] })
    setOpen(true)
  }
  const save = async (values: GroupForm) => {
    try {
      if (selected) await api.updatePermissionGroup(selected.id, values)
      else await api.createPermissionGroup(values)
      setOpen(false)
      await load()
      message.success('保存成功')
    } catch (error) { message.error((error as Error).message) }
  }
  const remove = async (group: PermissionGroup) => {
    try {
      await api.deletePermissionGroup(group.id)
      await load()
      message.success('已删除')
    } catch (error) { message.error((error as Error).message) }
  }
  const filteredGroups = groups.filter((group) => `${group.code} ${group.name} ${group.description || ''}`.toLowerCase().includes(keyword.trim().toLowerCase()))
  const columns = useMemo(() => [
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '权限数', width: 100, render: (_: unknown, row: PermissionGroup) => row.permissions.length },
    { title: '继承组', width: 180, render: (_: unknown, row: PermissionGroup) => groups.filter((group) => row.impliedGroupIds?.includes(group.id)).map((group) => group.name).join('、') || '-' },
    { title: '操作', width: 150, render: (_: unknown, row: PermissionGroup) => <Space>{can('platform.permission.write') && <Button type="link" onClick={() => edit(row)}>编辑</Button>}{can('platform.permission.unlink') && <Popconfirm title="确认删除该权限组？" onConfirm={() => void remove(row)} disabled={['platform_admin', 'platform_user'].includes(row.code)}><Button type="link" danger disabled={['platform_admin', 'platform_user'].includes(row.code)}>删除</Button></Popconfirm>}</Space> },
  ], [groups, can])

  return <div>
    <div className="page-title"><div><Typography.Title level={3}>权限管理</Typography.Title><Typography.Text type="secondary">维护权限组合、继承关系与授权属性</Typography.Text></div>{can('platform.permission.create') && <Button type="primary" icon={<PlusOutlined />} onClick={create}>创建</Button>}</div>
    <Input.Search className="list-filter" allowClear placeholder="筛选编码、名称或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
    <Table loading={loading} rowKey="id" columns={columns} dataSource={filteredGroups} pagination={{ pageSize: 50 }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover')) return; if (can('platform.permission.write')) edit(record) } })} />
    <Drawer title={selected ? '编辑权限组' : '创建权限组'} width={520} open={open} onClose={() => setOpen(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入权限组编码' }, { pattern: /^[a-z][a-z0-9_]{2,99}$/, message: '使用 3-100 位小写字母、数字或下划线' }]}><Input disabled={!!selected} /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入权限组名称' }]}><Input /></Form.Item>
        <Form.Item name="description" label="说明"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="permissions" label="权限" extra="权限组内权限会累加到所属用户"><Select mode="multiple" allowClear optionFilterProp="label" options={definitions.map((item) => ({ value: item.code, label: `${item.name} (${item.code})` }))} /></Form.Item>
        <Form.Item name="impliedGroupIds" label="继承权限组" extra="自动获得所选权限组的全部权限"><Select mode="multiple" allowClear options={groups.filter((group) => group.id !== selected?.id).map((group) => ({ value: group.id, label: `${group.name} (${group.code})` }))} /></Form.Item>
      </Form>
      {selected && <div className="permission-preview"><Typography.Text type="secondary">当前权限</Typography.Text><div>{selected.permissions.map((permission) => <Tag key={permission}>{permission}</Tag>) || '-'}</div></div>}
    </Drawer>
  </div>
}
