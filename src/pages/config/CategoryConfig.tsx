import { useEffect, useState } from 'react'
import { App, Button, Drawer, Form, Input, InputNumber, Popconfirm, Space, Table, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { api } from '../../api'
import type { DashboardCategory } from '../../types'
import { useAuth } from '../../auth'

type CategoryForm = Omit<DashboardCategory, 'id'>

export default function CategoryConfig() {
  const { message } = App.useApp()
  const { can } = useAuth()
  const [categories, setCategories] = useState<DashboardCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DashboardCategory | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CategoryForm>()

  const load = async () => {
    setLoading(true)
    try { setCategories(await api.adminCategories()) } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const create = () => { setSelected(null); form.resetFields(); form.setFieldsValue({ priority: categories.length + 1 }); setOpen(true) }
  const edit = (category: DashboardCategory) => { setSelected(category); form.resetFields(); form.setFieldsValue(category); setOpen(true) }
  const save = async (values: CategoryForm) => {
    try {
      if (selected) await api.updateCategory(selected.id, values)
      else await api.createCategory(values)
      setOpen(false)
      await load()
      message.success('保存成功')
    } catch (error) { message.error((error as Error).message) }
  }
  const remove = async (category: DashboardCategory) => {
    try { await api.deleteCategory(category.id); await load(); message.success('已删除，关联应用已归入未分类') } catch (error) { message.error((error as Error).message) }
  }

  return <div>
    <div className="page-title"><div><Typography.Title level={3}>控制台分类</Typography.Title><Typography.Text type="secondary">管理工作台分类及显示顺序，优先级越小越靠前</Typography.Text></div>{can('platform.app.create') && <Button type="primary" icon={<PlusOutlined />} onClick={create}>创建</Button>}</div>
    <Table className="config-table" loading={loading} rowKey="id" columns={[{ title: '编码', dataIndex: 'code', width: 220 }, { title: '名称', dataIndex: 'name', width: 180 }, { title: '优先级', dataIndex: 'priority', width: 120 }, { title: '操作', width: 160, render: (_: unknown, row: DashboardCategory) => <Space>{can('platform.app.write') && <Button type="link" onClick={() => edit(row)}>编辑</Button>}{can('platform.app.unlink') && <Popconfirm title="删除后关联应用将归入未分类，确认删除？" onConfirm={() => void remove(row)}><Button type="link" danger>删除</Button></Popconfirm>}</Space> }]} dataSource={categories} scroll={{ x: 680 }} pagination={false} />
    <Drawer title={selected ? '编辑控制台分类' : '创建控制台分类'} width={440} open={open} onClose={() => setOpen(false)} destroyOnClose extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
      <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
        <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入分类编码' }, { pattern: /^[a-z][a-z0-9_]{2,79}$/, message: '使用 3-80 位小写字母、数字或下划线' }]}><Input disabled={!!selected} /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入分类名称' }]}><Input /></Form.Item>
        <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Drawer>
  </div>
}
