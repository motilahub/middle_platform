import { useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { roleLabels } from '../../store'
import { User, UserRole } from '../../types'
import { api } from '../../api'

export default function UserConfig() {
  const { message } = App.useApp(); const [users, setUsers] = useState<User[]>([]); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<User | null>(null); const [open, setOpen] = useState(false); const [form] = Form.useForm<User>()
  const load = async () => { setLoading(true); try { setUsers(await api.users()) } catch (error) { message.error((error as Error).message) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const edit = (user: User) => { setSelected(user); form.setFieldsValue({ ...user, password: undefined }); setOpen(true) }
  const create = () => { setSelected(null); form.resetFields(); form.setFieldsValue({ role: 'user' }); setOpen(true) }
  const save = async (values: User) => { try { if (selected) await api.updateUser(selected.id, values); else await api.createUser({ ...values, password: values.password! }); setOpen(false); await load(); message.success('保存成功') } catch (error) { message.error((error as Error).message) } }
  const remove = async (user: User) => { if (user.code === 'admin') return; try { await api.deleteUser(user.id); await load(); message.success('已删除') } catch (error) { message.error((error as Error).message) } }
  const columns = useMemo(() => [{ title: '序号', width: 70, render: (_: unknown, __: User, i: number) => i + 1 }, { title: '编号', dataIndex: 'code' }, { title: '显示名称', dataIndex: 'name' }, { title: 'UUID', dataIndex: 'uuid' }, { title: '权限类别', dataIndex: 'role', render: (role: UserRole) => roleLabels[role] }, { title: '操作', width: 150, render: (_: unknown, row: User) => <Space><Button type="link" onClick={() => edit(row)}>编辑</Button><Popconfirm title="确认删除该用户？" onConfirm={() => void remove(row)} disabled={row.code === 'admin'}><Button type="link" danger disabled={row.code === 'admin'}>删除</Button></Popconfirm></Space> }], [users])
  return <div><div className="page-title"><div><Typography.Title level={3}>用户管理</Typography.Title><Typography.Text type="secondary">维护用户账号与工作台访问权限</Typography.Text></div><Button type="primary" icon={<PlusOutlined />} onClick={create}>创建</Button></div><Table loading={loading} rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 50 }} onRow={(record) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-popover')) return; edit(record) } })} /><Drawer title={selected ? '编辑用户' : '创建用户'} width={440} open={open} onClose={() => setOpen(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}><Form form={form} layout="vertical" onFinish={(values) => void save(values)}><Form.Item name="code" label="编号" rules={[{ required: true }]}><Input disabled={!!selected} /></Form.Item><Form.Item name="name" label="显示名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="password" label={selected ? '新密码（留空不修改）' : '密码'} rules={selected ? [] : [{ required: true }]}><Input.Password /></Form.Item><Form.Item name="role" label="权限类别" rules={[{ required: true }]}><Select options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} disabled={selected?.code === 'admin'} /></Form.Item></Form></Drawer></div>
}
