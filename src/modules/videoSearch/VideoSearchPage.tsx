import { useMemo, useState } from 'react'
import { App, Button, Empty, Input, Segmented, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd'
import { CloudOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import { videoSearchApi } from './api'
import type { VideoSearchResult, VideoSearchSourceStatus, VideoStorageType } from './types'

const STORAGE_META: Record<VideoStorageType, { label: string; color: string }> = {
  baidu: { label: '百度', color: 'blue' },
  aliyun: { label: '阿里云', color: 'geekblue' },
  quark: { label: '夸克', color: 'green' },
  tianyi: { label: '天翼云', color: 'volcano' },
  mobile: { label: '移动云盘', color: 'gold' },
  115: { label: '115', color: 'lime' },
  pikpak: { label: 'PikPak', color: 'magenta' },
  uc: { label: 'UC', color: 'orange' },
  xunlei: { label: '迅雷', color: 'purple' },
  guangya: { label: '光鸭', color: 'cyan' },
  123: { label: '123云盘', color: 'blue' },
  magnet: { label: '磁力', color: 'default' },
  ed2k: { label: '电驴', color: 'default' },
}

const PAGE_SIZE = 20

function SourceState({ source }: { source: VideoSearchSourceStatus }) {
  const color = source.status === 'success' ? 'success' : source.status === 'partial' ? 'warning' : 'error'
  const text = source.status === 'failed' ? `${source.name}失败` : `${source.name} ${source.count}`
  return <Tooltip title={source.message}><Tag color={color}>{text}</Tag></Tooltip>
}

export default function VideoSearchPage() {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<VideoSearchResult[]>([])
  const [sourceStates, setSourceStates] = useState<VideoSearchSourceStatus[]>([])
  const [filter, setFilter] = useState<'all' | VideoStorageType>('all')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [resolvingId, setResolvingId] = useState<string>()
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const search = async () => {
    const value = keyword.trim()
    if (!value) { message.warning('请输入影视名称'); return }
    setLoading(true)
    setSearched(true)
    setResults([])
    setSourceStates([])
    setFilter('all')
    setPage(1)
    setSelectedIds([])
    try {
      const response = await videoSearchApi.search(value)
      setResults(response.results)
      setSourceStates(response.sources)
      if (response.sources.every((source) => source.status === 'failed')) message.error('所有搜索源均暂不可用')
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const openResult = async (result: VideoSearchResult) => {
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!result.resolveToken || resolvingId) return
    const openingPath = '/video-search/opening'
    const popup = window.open(openingPath, '_blank')
    if (!popup) {
      message.warning('浏览器阻止了新窗口，请允许弹出窗口后重试')
      return
    }
    popup.opener = null
    setResolvingId(result.id)
    try {
      const response = await videoSearchApi.resolve(result.resolveToken)
      if (!popup.closed) popup.location.replace(response.url)
    } catch (error) {
      const errorMessage = (error as Error).message || '暂时无法获取网盘链接'
      if (!popup.closed) popup.location.replace(`${openingPath}?status=failed&message=${encodeURIComponent(errorMessage.slice(0, 160))}`)
      message.error(errorMessage)
    } finally {
      setResolvingId(undefined)
    }
  }

  const counts = useMemo(() => results.reduce<Record<string, number>>((map, item) => {
    map[item.storageType] = (map[item.storageType] || 0) + 1
    return map
  }, {}), [results])
  const copySelectedNames = async () => {
    try {
      await navigator.clipboard.writeText(results.filter((item) => selectedIds.includes(item.id)).map((item) => item.title).join('\n'))
      message.success('已复制所选资源名称')
    } catch {
      message.error('复制失败，请检查浏览器剪贴板权限')
    }
  }
  const filteredResults = filter === 'all' ? results : results.filter((item) => item.storageType === filter)
  const filterOptions = [
    { label: `全部 ${results.length}`, value: 'all' },
    ...Object.entries(STORAGE_META).map(([value, meta]) => ({ label: `${meta.label} ${counts[value] || 0}`, value })),
  ]
  const columns: ColumnsType<VideoSearchResult> = [
    { title: '序号', width: 72, render: (_value, _row, index) => (page - 1) * PAGE_SIZE + index + 1 },
    {
      title: '资源名称', dataIndex: 'title', ellipsis: true,
      render: (title: string, row) => <Button className="video-result-link" type="link" title={title} onClick={() => void openResult(row)} disabled={Boolean(resolvingId && resolvingId !== row.id)}>{resolvingId === row.id && <Spin size="small" />}<span>{title}</span></Button>,
    },
    { title: '网盘', dataIndex: 'storageType', width: 92, render: (value: VideoStorageType) => <Tag color={STORAGE_META[value].color}>{STORAGE_META[value].label}</Tag> },
    { title: '搜索源', dataIndex: 'providerName', width: 100 },
    { title: '来源线路', dataIndex: 'sourceLine', width: 150, render: (value?: string) => value || '-' },
  ]

  return <div className="video-search-page">
    <SystemHeader />
    <main className="video-search-main">
      <section className="video-search-toolbar">
        <div className="video-search-title"><CloudOutlined /><Typography.Title level={2}>天影查</Typography.Title></div>
        <div className="video-search-controls">
          <Input.Search className="video-search-input" size="large" value={keyword} maxLength={50} allowClear enterButton="搜索" placeholder="影视名称" loading={loading} onChange={(event) => setKeyword(event.target.value)} onSearch={() => void search()} />
        </div>
      </section>
      <section className="video-search-results">
        <div className="video-result-tools">
          <Segmented value={filter} options={filterOptions} onChange={(value) => { setFilter(value as 'all' | VideoStorageType); setPage(1); setSelectedIds([]) }} />
          <Space size={[4, 6]} wrap>{sourceStates.map((source) => <SourceState key={source.id} source={source} />)}</Space>
        </div>
        <div className="video-result-batch"><Button disabled={!selectedIds.length} onClick={() => void copySelectedNames()}>复制所选名称</Button><Typography.Text type="secondary">已选 {selectedIds.length} 条</Typography.Text></div>
        <Table<VideoSearchResult> size="small" rowKey="id" loading={loading} columns={columns} dataSource={filteredResults} rowSelection={{ selectedRowKeys: selectedIds, preserveSelectedRowKeys: true, onChange: (keys) => setSelectedIds(keys as string[]) }} scroll={{ x: 760 }} pagination={{ current: page, pageSize: PAGE_SIZE, showSizeChanger: false, onChange: setPage, showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searched ? '暂无匹配结果' : '暂无搜索结果'} /> }} />
      </section>
    </main>
    <SystemFooter />
  </div>
}
