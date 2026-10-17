import { Alert, App, Button, Drawer, Empty, Input, Segmented, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { mediaLibraryApi } from './api'
import type { MediaItem, PanResource } from './types'

type StorageFilter = 'all' | PanResource['storageType']

const STORAGE_META: Record<PanResource['storageType'], { label: string; color: string }> = {
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

const STORAGE_ORDER: PanResource['storageType'][] = ['quark', 'baidu', 'aliyun', 'xunlei', 'uc', '115', 'tianyi', 'mobile', 'pikpak', '123', 'guangya', 'magnet', 'ed2k']

export default function ResourceDrawer({ item, open, darkMode, onClose }: {
  item: MediaItem
  open: boolean
  darkMode: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [results, setResults] = useState<PanResource[]>()
  const [searchError, setSearchError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string>()
  const [storageFilter, setStorageFilter] = useState<StorageFilter>('all')
  const [resultKeyword, setResultKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    let active = true
    setResults(undefined)
    setSearchError('')
    setStorageFilter('all')
    setResultKeyword('')
    setPage(1)
    setSelectedIds([])
    setLoading(true)
    mediaLibraryApi.searchPan(item.title)
      .then((output) => {
        if (!active) return
        setResults(output.results)
        const failedSources = (output.sources || []).filter((source) => source.status === 'failed')
        if (!output.results.length && failedSources.length) setSearchError(failedSources.map((source) => source.message || '搜索服务暂时不可用').join('；'))
      })
      .catch((error) => { if (active) { setResults([]); message.error((error as Error).message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [item.title, message, open])

  const openPan = async (resource: PanResource) => {
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!resource.resolveToken || resolvingId) return
    const openingPath = '/video-search/opening'
    const popup = window.open(openingPath, '_blank')
    if (!popup) { message.warning('浏览器阻止了新窗口'); return }
    popup.opener = null
    setResolvingId(resource.id)
    try {
      const output = await mediaLibraryApi.resolvePan(resource.resolveToken)
      if (!popup.closed) popup.location.replace(output.url)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (!popup.closed) popup.location.replace(`${openingPath}?status=failed&message=${encodeURIComponent(errorMessage.slice(0, 160))}`)
      message.error(errorMessage)
    } finally {
      setResolvingId(undefined)
    }
  }

  const storageCounts = useMemo(() => (results || []).reduce<Record<string, number>>((counts, resource) => {
    counts[resource.storageType] = (counts[resource.storageType] || 0) + 1
    return counts
  }, {}), [results])
  const normalizedKeyword = resultKeyword.trim().toLocaleLowerCase('zh-CN')
  const filteredResults = useMemo(() => (results || []).filter((resource) => {
    if (storageFilter !== 'all' && resource.storageType !== storageFilter) return false
    if (!normalizedKeyword) return true
    return `${resource.title} ${resource.providerName} ${resource.sourceLine || ''}`.toLocaleLowerCase('zh-CN').includes(normalizedKeyword)
  }), [normalizedKeyword, results, storageFilter])
  const storageOptions = useMemo(() => [
    { label: `全部 ${results?.length || 0}`, value: 'all' },
    ...STORAGE_ORDER.map((value) => ({ label: `${STORAGE_META[value].label} ${storageCounts[value] || 0}`, value })),
  ], [results, storageCounts])
  const copySelectedNames = async () => {
    try {
      await navigator.clipboard.writeText((results || []).filter((resource) => selectedIds.includes(resource.id)).map((resource) => resource.title).join('\n'))
      message.success('已复制所选资源名称')
    } catch {
      message.error('复制失败，请检查浏览器剪贴板权限')
    }
  }
  const columns: ColumnsType<PanResource> = [
    { title: '序号', width: 54, render: (_value, _row, index) => (page - 1) * 10 + index + 1 },
    { title: '资源名称', dataIndex: 'title', ellipsis: true, render: (title: string, resource) => <Button className="video-result-link" type="link" title={title} disabled={Boolean(resolvingId && resolvingId !== resource.id)} onClick={() => void openPan(resource)}><span>{title}</span></Button> },
    { title: '网盘', dataIndex: 'storageType', width: 74, render: (value: PanResource['storageType']) => <Tag color={STORAGE_META[value].color}>{STORAGE_META[value].label}</Tag> },
    { title: '来源线路', dataIndex: 'sourceLine', width: 100, ellipsis: true, render: (value: string | undefined, resource) => value || resource.providerName },
    { title: '操作', width: 64, fixed: 'right', render: (_value, resource) => <Button type="link" loading={resolvingId === resource.id} disabled={Boolean(resolvingId && resolvingId !== resource.id)} onClick={() => void openPan(resource)}>打开</Button> },
  ]

  return <Drawer rootClassName={`media-resource-drawer${darkMode ? ' is-dark' : ''}`} title={item.title} width={620} open={open} onClose={onClose} destroyOnClose>
    <Typography.Text type="secondary">选择网盘资源</Typography.Text>
    {loading
      ? <div className="media-resource-loading"><Spin /></div>
      : results?.length
        ? <>
          <div className="media-resource-tools">
            <Input allowClear prefix={<SearchOutlined />} value={resultKeyword} placeholder="搜索资源名称、搜索源或线路" onChange={(event) => { setResultKeyword(event.target.value); setPage(1); setSelectedIds([]) }} />
            <Segmented value={storageFilter} options={storageOptions} onChange={(value) => { setStorageFilter(value as StorageFilter); setPage(1); setSelectedIds([]) }} />
            <div className="media-resource-batch"><Button disabled={!selectedIds.length} onClick={() => void copySelectedNames()}>复制所选名称</Button><Typography.Text type="secondary">已选 {selectedIds.length} 条</Typography.Text></div>
          </div>
          {filteredResults.length
            ? <Table<PanResource> className="media-resource-table" size="small" rowKey="id" columns={columns} dataSource={filteredResults} rowSelection={{ selectedRowKeys: selectedIds, preserveSelectedRowKeys: true, onChange: (keys) => setSelectedIds(keys as string[]) }} scroll={{ x: 530 }} pagination={{ current: page, pageSize: 10, onChange: setPage, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} />
            : <Empty className="media-resource-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合筛选条件的资源" />}
        </>
        : searchError
          ? <Alert type="warning" showIcon message="网盘资源搜索失败" description={searchError} />
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网盘资源" />}
  </Drawer>
}
