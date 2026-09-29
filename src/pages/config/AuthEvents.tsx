import { useEffect, useState } from 'react'
import { App, Button, Descriptions, Drawer, Input, Select, Space, Table, Typography } from 'antd'
import { api, type AuthEvent, type AuthEventPage } from '../../api'

const labels: Record<string, string> = { login: '登录', logout: '退出', register: '注册', reset: '重置密码', code_register: '注册验证码', code_reset: '重置验证码', test_mail: '测试邮件', mail_settings: '邮件配置' }
const outcomes: Record<string, string> = { success: '成功', failed: '失败', sent: '已发送', requested: '已申请', limited: '触发限流', cooldown: '重发间隔', updated: '已更新' }

export default function AuthEvents() {
  const { message } = App.useApp()
  const [result, setResult] = useState<AuthEventPage>({ rows: [], total: 0, page: 1, pageSize: 20 })
  const [action, setAction] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [detail, setDetail] = useState<AuthEvent | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); void api.authEvents(result.page, result.pageSize, action, keyword).then(setResult).catch((error: Error) => message.error(error.message)).finally(() => setLoading(false)) }, [result.page, result.pageSize, action, keyword, message])
  const exportSelected = () => {
    const chosen = result.rows.filter((row) => selected.includes(row.id))
    const content = [['时间', '事件', '结果', '登录名/用户', 'IP'], ...chosen.map((row) => [new Date(row.created_at).toLocaleString('zh-CN'), labels[row.action] || row.action, outcomes[row.outcome] || row.outcome, row.login_identifier || row.user_code || '', row.ip_address || ''])]
    const csv = '\uFEFF' + content.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'auth-events.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const columns = [
    { title: '序号', width: 80, render: (_: unknown, __: AuthEvent, index: number) => (result.page - 1) * result.pageSize + index + 1 },
    { title: '时间', dataIndex: 'created_at', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
    { title: '事件', dataIndex: 'action', render: (value: string) => labels[value] || value },
    { title: '结果', dataIndex: 'outcome', render: (value: string) => outcomes[value] || value },
    { title: '登录名/用户', render: (_: unknown, row: AuthEvent) => row.login_identifier || row.user_code || '-' },
    { title: 'IP', dataIndex: 'ip_address', render: (value: string | null) => value || '-' },
  ]
  return <div><div className="page-title"><Typography.Title level={3}>认证日志</Typography.Title><Button disabled={!selected.length} onClick={exportSelected}>导出选中</Button></div>
    <Space wrap className="auth-event-filters"><Select value={action} style={{ width: 160 }} options={[{ value: '', label: '全部事件' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} onChange={(value) => { setAction(value); setSelected([]); setResult((previous) => ({ ...previous, page: 1 })) }} /><Input.Search allowClear placeholder="筛选登录名、用户或 IP" value={draft} onChange={(event) => { setDraft(event.target.value); if (!event.target.value) setKeyword('') }} onSearch={(value) => { setKeyword(value.trim()); setSelected([]); setResult((previous) => ({ ...previous, page: 1 })) }} /></Space>
    <Table className="config-table" rowKey="id" loading={loading} columns={columns} dataSource={result.rows} scroll={{ x: 780 }} rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) }} pagination={{ current: result.page, pageSize: result.pageSize, total: result.total, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 条`, onChange: (page, pageSize) => { setSelected([]); setResult((previous) => ({ ...previous, page, pageSize })) } }} onRow={(row) => ({ style: { cursor: 'pointer' }, onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-checkbox-wrapper')) return; setDetail(row) } })} />
    <Drawer title="认证日志详情" width="min(560px, 100vw)" open={!!detail} onClose={() => setDetail(null)} destroyOnClose>
      {detail && <Descriptions column={1} bordered size="small" labelStyle={{ width: 120 }}>
        <Descriptions.Item label="记录编号">{detail.id}</Descriptions.Item>
        <Descriptions.Item label="时间">{new Date(detail.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
        <Descriptions.Item label="事件">{labels[detail.action] || detail.action}</Descriptions.Item>
        <Descriptions.Item label="结果">{outcomes[detail.outcome] || detail.outcome}</Descriptions.Item>
        {detail.action === 'login' && <Descriptions.Item label="尝试登录名"><Typography.Text style={{ overflowWrap: 'anywhere' }}>{detail.login_identifier || '-'}</Typography.Text></Descriptions.Item>}
        <Descriptions.Item label="匹配用户">{detail.user_code || '-'}</Descriptions.Item>
        <Descriptions.Item label="来源 IP">{detail.ip_address || '-'}</Descriptions.Item>
        {detail.action === 'login' && <Descriptions.Item label="客户端"><Typography.Text style={{ overflowWrap: 'anywhere' }}>{detail.user_agent || '-'}</Typography.Text></Descriptions.Item>}
      </Descriptions>}
    </Drawer>
  </div>
}
