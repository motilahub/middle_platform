import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { roleLabels } from '../../store'
import { PermissionGroup, User, UserRole } from '../../types'
import { api } from '../../api'
import { useAuth } from '../../auth'

export default function UserConfig() {
  const { message } = App.useApp(); const { can } = useAuth(); const [users, setUsers] = useState<User[]>([]); const [groups, setGroups] = useState<PermissionGroup[]>([]); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<User | null>(null); const [open, setOpen] = useState(false); const [form] = Form.useForm<User>(); const [keyword, setKeyword] = useState('')
  const load = async () => { setLoading(true); try { const [userRows, groupRows] = await Promise.all([api.users(), api.permissionGroups()]); setUsers(userRows); setGroups(groupRows) } catch (error) { message.error((error as Error).message) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const groupIdsFor = (user: User) => groups.filter((group) => user.groups?.some((item) => item.code === group.code)).map((group) => group.id)
  const edit = (user: User) => { setSelected(user); form.setFieldsValue({ ...user, groupIds: groupIdsFor(user), password: undefined }); setOpen(true) }
  const create = () => { setSelected(null); form.resetFields(); form.setFieldsValue({ code: undefined, name: undefined, password: undefined, role: 'user', groupIds: groups.filter((group) => group.code === 'platform_user').map((group) => group.id) }); setOpen(true) }
  const copyToClipboard = async (value: string | undefined, label: string) => {
    if (!value) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else {
        const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove()
      }
      message.success(`${label}已复制`)
    } catch {
      message.error(`${label}复制失败`)
    }
  }
  const save = async (values: User) => { const { uuid: _uuid, ...editableValues } = values; try { if (selected) await api.updateUser(selected.id, editableValues); else await api.createUser({ ...editableValues, password: editableValues.password! }); setOpen(false); await load(); message.success('保存成功') } catch (error) { message.error((error as Error).message) } }
  const remove = async (user: User) => { if (user.code === 'admin') return; try { await api.deleteUser(user.id); await load(); message.success('已删除') } catch (error) { message.error((error as Error).message) } }
  const columns = useMemo(() => [{ title: '序号', width: 70, render: (_: unknown, __: User, i: number) => i + 1 }, { title: '账号', dataIndex: 'code', render: (code: string, row: User) => <Typography.Text style={{ cursor: 'copy' }} onClick={(event) => { event.stopPropagation(); void copyToClipboard(code, '账号') }}>{code}</Typography.Text> }, { title: '显示名称', dataIndex: 'name' }, { title: '权限类别', dataIndex: 'role', render: (role: UserRole) => roleLabels[role] }, { title: '权限组', render: (_: unknown, row: User) => row.groups?.map((group) => group.name).join('、') || '未分配' }, { title: '操作', width: 150, render: (_: unknown, row: User) => <Space>{can('platform.user.write') && <Button type="link" onClick={() => edit(row)}>编辑</Button>}{can('platform.user.unlink') && <Popconfirm title="确认删除该用户？" onConfirm={() => void remove(row)} disabled={row.code === 'admin'}><Button type="link" danger disabled={row.code === 'admin'}>删除</Button></Popconfirm>}</Space> }], [users, groups, can])
  const filteredUsers = users.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(keyword.trim().toLowerCase()))
  return <div><div className="page-title"><div><Typography.Title level={3}>用户管理</Typography.Title><Typography.Text type="secondary">维护用户账号、权限组与工作台访问权限</Typography.Text></div>{can('platform.user.create') && <Button type="primary" icon={<PlusOutlined />} onClick={create}>创建</Button>}</div><Input.Search className="list-filter" allowClear placeholder="筛选账号或显示名称" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Table loading={loading} rowKey="id" columns={columns} dataSource={filteredUsers} pagination={{ pageSize: 50 }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover')) return; if (can('platform.user.write')) edit(record) } })} /><Drawer title={selected ? '编辑用户' : '创建用户'} width={440} open={open} onClose={() => setOpen(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}><Form form={form} layout="vertical" onFinish={(values) => void save(values)} autoComplete="off"><Form.Item name="uuid" label="UUID"><Input readOnly placeholder="创建后自动生成" onClick={() => void copyToClipboard(selected?.uuid, 'UUID')} /></Form.Item><Form.Item name="code" label="账号" rules={[{ required: true }]}><Input readOnly={!!selected} autoComplete="off" onClick={() => { if (selected) void copyToClipboard(selected.code, '账号') }} /></Form.Item><Form.Item name="name" label="显示名称" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item><Form.Item name="password" label={selected ? '新密码（留空不修改）' : '密码'} rules={selected ? [] : [{ required: true }]}><Input.Password autoComplete="new-password" /></Form.Item><Form.Item name="role" label="兼容权限类别" rules={[{ required: true }]}><Select options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} disabled={selected?.code === 'admin'} /></Form.Item><Form.Item name="groupIds" label="权限组" extra="权限组决定菜单、CRUD 和后续数据范围；可多选"><Select mode="multiple" options={groups.map((group) => ({ value: group.id, label: `${group.name} (${group.code})` }))} /></Form.Item></Form></Drawer></div>
}
