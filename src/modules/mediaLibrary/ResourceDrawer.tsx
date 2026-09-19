import { App, Button, Drawer, Empty, Input, List, Segmented, Spin, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { mediaLibraryApi } from './api'
import type { MediaItem, PanResource } from './types'

type StorageFilter = 'all' | PanResource['storageType']

const STORAGE_META: Record<PanResource['storageType'], { label: string; color: string }> = {
  baidu: { label: '百度', color: 'blue' },
  quark: { label: '夸克', color: 'green' },
  uc: { label: 'UC', color: 'orange' },
  xunlei: { label: '迅雷', color: 'purple' },
}

export default function ResourceDrawer({ item, open, onClose }: {
  item: MediaItem
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [results, setResults] = useState<PanResource[]>()
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string>()
  const [storageFilter, setStorageFilter] = useState<StorageFilter>('all')
  const [resultKeyword, setResultKeyword] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!open) return
    setResults(undefined)
    setStorageFilter('all')
    setResultKeyword('')
    setPage(1)
    setLoading(true)
    mediaLibraryApi.searchPan(item.title)
      .then((output) => setResults(output.results))
      .catch((error) => { setResults([]); message.error((error as Error).message) })
      .finally(() => setLoading(false))
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
    ...Object.entries(STORAGE_META).map(([value, meta]) => ({ label: `${meta.label} ${storageCounts[value] || 0}`, value })),
  ], [results, storageCounts])

  return <Drawer title={item.title} width={620} open={open} onClose={onClose} destroyOnClose>
    <Typography.Text type="secondary">选择网盘资源</Typography.Text>
    {loading
      ? <div className="media-resource-loading"><Spin /></div>
      : results?.length
        ? <>
          <div className="media-resource-tools">
            <Input allowClear prefix={<SearchOutlined />} value={resultKeyword} placeholder="搜索资源名称、搜索源或线路" onChange={(event) => { setResultKeyword(event.target.value); setPage(1) }} />
            <Segmented value={storageFilter} options={storageOptions} onChange={(value) => { setStorageFilter(value as StorageFilter); setPage(1) }} />
          </div>
          {filteredResults.length
            ? <List className="media-resource-list" dataSource={filteredResults} pagination={{ current: page, pageSize: 10, hideOnSinglePage: true, onChange: setPage }} renderItem={(resource) => <List.Item actions={[<Button key="open" type="link" loading={resolvingId === resource.id} disabled={Boolean(resolvingId && resolvingId !== resource.id)} onClick={() => void openPan(resource)}>打开</Button>]}>
              <List.Item.Meta title={resource.title} description={<><Tag color={STORAGE_META[resource.storageType].color}>{STORAGE_META[resource.storageType].label}</Tag>{resource.sourceLine || resource.providerName}</>} />
            </List.Item>}
            />
            : <Empty className="media-resource-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合筛选条件的资源" />}
        </>
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网盘资源" />}
  </Drawer>
}
