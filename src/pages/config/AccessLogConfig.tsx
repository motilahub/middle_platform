import { useCallback, useEffect, useState } from 'react'
import { App, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ssoApi, type AccessLog } from '../../platform/sso/api'

export default function AccessLogConfig() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState({ current: 1, pageSize: 20 })
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await ssoApi.accessLogs({ keyword, method, status, page: page.current, pageSize: page.pageSize })
      setRows(result.rows)
    } catch (error) { message.error((error as Error).message) } finally { setLoading(false) }
  }, [keyword, method, message, page])
  useEffect(() => { void load() }, [load])
  const resetPage = () => setPage((value) => ({ ...value, current: 1 }))
  const columns = [
    { title: '序号', width: 70, render: (_: unknown, __: AccessLog, index: number) => (page.current - 1) * page.pageSize + index + 1 },
    { title: '访问时间', dataIndex: 'createdAt', width: 180, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
    { title: '用户', width: 150, render: (_: unknown, row: AccessLog) => row.userName ? `${row.userName} (${row.userCode || '-'})` : '匿名用户' },
    { title: '请求', width: 90, render: (_: unknown, row: AccessLog) => <Tag color={row.method === 'GET' ? 'blue' : 'gold'}>{row.method}</Tag> },
    { title: '路径', dataIndex: 'path', ellipsis: true, width: 300 },
    { title: '状态', dataIndex: 'statusCode', width: 90, render: (value: number) => <Tag color={value >= 500 ? 'red' : value >= 400 ? 'orange' : 'green'}>{value}</Tag> },
    { title: '来源 IP', dataIndex: 'ipAddress', width: 150, ellipsis: true },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (value?: number) => value == null ? '-' : `${value} ms` },
    { title: '客户端', dataIndex: 'userAgent', width: 260, ellipsis: true },
  ]
  return <div>
    <div className="page-title"><div><Typography.Title level={3}>访问日志</Typography.Title><Typography.Text type="secondary">查看平台请求访问记录和响应状态</Typography.Text></div></div>
    <Space className="list-filter" wrap>
      <Input.Search allowClear placeholder="筛选路径、用户或 IP" value={keyword} onChange={(event) => { setKeyword(event.target.value); resetPage() }} onSearch={resetPage} />
      <Select allowClear placeholder="请求方法" value={method || undefined} onChange={(value) => { setMethod(value || ''); resetPage() }} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ label: value, value }))} />
      <Select allowClear placeholder="状态码" value={status || undefined} onChange={(value) => { setStatus(value || ''); resetPage() }} options={[['200', '200 成功'], ['201', '201 已创建'], ['301', '301 跳转'], ['400', '400 请求错误'], ['401', '401 未认证'], ['403', '403 无权限'], ['404', '404 不存在'], ['500', '500 服务错误']].map(([value, label]) => ({ label, value }))} />
    </Space>
    <Table className="config-table" loading={loading} rowKey="id" columns={columns} dataSource={rows} scroll={{ x: 1260 }} pagination={{ current: page.current, pageSize: page.pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `共 ${total} 条`, onChange: (current, pageSize) => setPage({ current, pageSize }) }} />
  </div>
}
