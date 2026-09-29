import { useEffect, useState } from 'react'
import { App, Button, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ssoApi, type AccessLog } from '../../platform/sso/api'

const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN')
const formatUser = (row: AccessLog) => row.userName ? `${row.userName} (${row.userCode || '-'})` : row.userCode || '匿名用户'
const formatStatus = (value: number) => <Tag color={value >= 500 ? 'red' : value >= 400 ? 'orange' : 'green'}>{value}</Tag>

function exportLogs(rows: AccessLog[]) {
  const headers = ['访问时间', '用户', '请求方法', '路径', '状态码', '来源 IP', '耗时 (ms)', '来源页面', '客户端']
  const escapeCell = (value: string | number | undefined) => {
    const text = String(value ?? '')
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const content = [headers, ...rows.map((row) => [formatTime(row.createdAt), formatUser(row), row.method, row.path, row.statusCode, row.ipAddress, row.durationMs, row.referer, row.userAgent])]
    .map((line) => line.map(escapeCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `访问日志-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function AccessLogConfig() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<AccessLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState({ current: 1, pageSize: 20 })
  const [checked, setChecked] = useState<number[]>([])
  const [selected, setSelected] = useState<AccessLog | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    ssoApi.accessLogs({ keyword, method, status, page: page.current, pageSize: page.pageSize })
      .then((result) => { if (active) { setRows(result.rows); setTotal(result.total) } })
      .catch((error: Error) => { if (active) message.error(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [keyword, method, status, page.current, page.pageSize, message])

  const resetPage = () => { setPage((value) => ({ ...value, current: 1 })); setChecked([]) }
  const columns = [
    { title: '序号', width: 70, render: (_: unknown, __: AccessLog, index: number) => (page.current - 1) * page.pageSize + index + 1 },
    { title: '访问时间', dataIndex: 'createdAt', width: 180, render: formatTime },
    { title: '用户', width: 150, render: (_: unknown, row: AccessLog) => formatUser(row) },
    { title: '请求', width: 90, render: (_: unknown, row: AccessLog) => <Tag color={row.method === 'GET' ? 'blue' : 'gold'}>{row.method}</Tag> },
    { title: '路径', dataIndex: 'path', ellipsis: true, width: 300 },
    { title: '状态', dataIndex: 'statusCode', width: 90, render: formatStatus },
    { title: '来源 IP', dataIndex: 'ipAddress', width: 150, ellipsis: true },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (value?: number) => value == null ? '-' : `${value} ms` },
    { title: '客户端', dataIndex: 'userAgent', width: 260, ellipsis: true },
    { title: '操作', width: 85, render: (_: unknown, row: AccessLog) => <Button type="link" onClick={() => setSelected(row)}>查看</Button> },
  ]
  return <div>
    <div className="page-title"><div><Typography.Title level={3}>访问日志</Typography.Title><Typography.Text type="secondary">查看平台请求访问记录和响应状态</Typography.Text></div><Button disabled={!checked.length} onClick={() => exportLogs(rows.filter((row) => checked.includes(row.id)))}>导出选中</Button></div>
    <Space className="list-filter access-log-filters" wrap>
      <Input.Search allowClear placeholder="筛选路径、用户或 IP" value={keyword} onChange={(event) => { setKeyword(event.target.value); resetPage() }} />
      <Select allowClear placeholder="请求方法" value={method || undefined} onChange={(value) => { setMethod(value || ''); resetPage() }} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ label: value, value }))} />
      <Select allowClear placeholder="状态码" value={status || undefined} onChange={(value) => { setStatus(value || ''); resetPage() }} options={[['200', '200 成功'], ['201', '201 已创建'], ['301', '301 跳转'], ['400', '400 请求错误'], ['401', '401 未认证'], ['403', '403 无权限'], ['404', '404 不存在'], ['500', '500 服务错误']].map(([value, label]) => ({ label, value }))} />
    </Space>
    <Table className="config-table" loading={loading} rowKey="id" columns={columns} dataSource={rows} scroll={{ x: 1380 }} rowSelection={{ selectedRowKeys: checked, onChange: (keys) => setChecked(keys as number[]) }} pagination={{ current: page.current, pageSize: page.pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (count) => `共 ${count} 条`, onChange: (current, pageSize) => { setPage({ current, pageSize }); setChecked([]) } }} onRow={(record) => ({ style: { cursor: 'pointer' }, onClick: (event) => { if ((event.target as HTMLElement).closest('button,.ant-checkbox-wrapper')) return; setSelected(record) } })} />
    <Drawer title="访问日志详情" width="min(560px, 100vw)" open={!!selected} onClose={() => setSelected(null)} destroyOnClose>
      {selected && <Descriptions column={1} bordered size="small" labelStyle={{ width: 120 }}>
        <Descriptions.Item label="访问时间">{formatTime(selected.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="用户">{formatUser(selected)}</Descriptions.Item>
        <Descriptions.Item label="请求方法">{selected.method}</Descriptions.Item>
        <Descriptions.Item label="请求路径"><Typography.Text style={{ overflowWrap: 'anywhere' }}>{selected.path}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="响应状态">{formatStatus(selected.statusCode)}</Descriptions.Item>
        <Descriptions.Item label="来源 IP">{selected.ipAddress || '-'}</Descriptions.Item>
        <Descriptions.Item label="耗时">{selected.durationMs == null ? '-' : `${selected.durationMs} ms`}</Descriptions.Item>
        <Descriptions.Item label="来源页面"><Typography.Text style={{ overflowWrap: 'anywhere' }}>{selected.referer || '-'}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="客户端"><Typography.Text style={{ overflowWrap: 'anywhere' }}>{selected.userAgent || '-'}</Typography.Text></Descriptions.Item>
      </Descriptions>}
    </Drawer>
  </div>
}
