import { App, Button, Drawer, Empty, Input, List, Segmented, Spin, Tabs, Tag, Typography } from 'antd'
import { CloudDownloadOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { mediaLibraryApi } from './api'
import type { MediaItem, PanResource, PlayableResource } from './types'

type ResourceMode = 'pan' | 'playable'
type StorageFilter = 'all' | PanResource['storageType']

const STORAGE_META: Record<PanResource['storageType'], { label: string; color: string }> = {
  baidu: { label: '百度', color: 'blue' },
  quark: { label: '夸克', color: 'green' },
  uc: { label: 'UC', color: 'orange' },
  xunlei: { label: '迅雷', color: 'purple' },
}

function resourceTitle(item: MediaItem, episode?: number) {
  return `${item.title}${episode ? ` 第${String(episode).padStart(2, '0')}集` : ''}`
}

export default function ResourceDrawer({ item, episode, mode, open, onClose }: {
  item: MediaItem
  episode?: number
  mode: ResourceMode
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [activeMode, setActiveMode] = useState<ResourceMode>(mode)
  const [panResults, setPanResults] = useState<PanResource[]>()
  const [playableResults, setPlayableResults] = useState<PlayableResource[]>()
  const [playableMessage, setPlayableMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string>()
  const [storageFilter, setStorageFilter] = useState<StorageFilter>('all')
  const [resultKeyword, setResultKeyword] = useState('')
  const [panPage, setPanPage] = useState(1)
  const title = useMemo(() => resourceTitle(item, episode), [episode, item])

  const search = async (nextMode: ResourceMode) => {
    setLoading(true)
    try {
      if (nextMode === 'pan') {
        const output = await mediaLibraryApi.searchPan(title)
        setPanResults(output.results)
      } else {
        const output = await mediaLibraryApi.searchPlayable(item.id, episode)
        setPlayableResults(output.results)
        setPlayableMessage(output.message || '')
      }
    } catch (error) {
      message.error((error as Error).message)
      if (nextMode === 'pan') setPanResults([])
      else setPlayableResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setActiveMode(mode)
    setPanResults(undefined)
    setPlayableResults(undefined)
    setPlayableMessage('')
    setStorageFilter('all')
    setResultKeyword('')
    setPanPage(1)
    void search(mode)
    // Search state is intentionally reset for each selected title or episode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, item.id, episode])

  const changeMode = (nextMode: string) => {
    const value = nextMode as ResourceMode
    setActiveMode(value)
    if (value === 'pan' ? panResults === undefined : playableResults === undefined) void search(value)
  }

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

  const openPlayable = (resource: PlayableResource) => {
    const query = new URLSearchParams({ src: resource.url, title, mode: resource.type === 'hls' ? 'hls' : 'direct' })
    window.open(`/video-player?${query.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const storageCounts = useMemo(() => (panResults || []).reduce<Record<string, number>>((counts, resource) => {
    counts[resource.storageType] = (counts[resource.storageType] || 0) + 1
    return counts
  }, {}), [panResults])
  const normalizedKeyword = resultKeyword.trim().toLocaleLowerCase('zh-CN')
  const filteredPanResults = useMemo(() => (panResults || []).filter((resource) => {
    if (storageFilter !== 'all' && resource.storageType !== storageFilter) return false
    if (!normalizedKeyword) return true
    return `${resource.title} ${resource.providerName} ${resource.sourceLine || ''}`.toLocaleLowerCase('zh-CN').includes(normalizedKeyword)
  }), [normalizedKeyword, panResults, storageFilter])
  const storageOptions = useMemo(() => [
    { label: `全部 ${panResults?.length || 0}`, value: 'all' },
    ...Object.entries(STORAGE_META).map(([value, meta]) => ({ label: `${meta.label} ${storageCounts[value] || 0}`, value })),
  ], [panResults, storageCounts])

  const panContent = loading && activeMode === 'pan'
    ? <div className="media-resource-loading"><Spin /></div>
    : panResults?.length
      ? <>
        <div className="media-resource-tools">
          <Input allowClear prefix={<SearchOutlined />} value={resultKeyword} placeholder="搜索资源名称、搜索源或线路" onChange={(event) => { setResultKeyword(event.target.value); setPanPage(1) }} />
          <Segmented value={storageFilter} options={storageOptions} onChange={(value) => { setStorageFilter(value as StorageFilter); setPanPage(1) }} />
        </div>
        {filteredPanResults.length
          ? <List className="media-resource-list" dataSource={filteredPanResults} pagination={{ current: panPage, pageSize: 10, hideOnSinglePage: true, onChange: setPanPage }} renderItem={(resource) => <List.Item actions={[<Button key="open" type="link" loading={resolvingId === resource.id} disabled={Boolean(resolvingId && resolvingId !== resource.id)} onClick={() => void openPan(resource)}>打开</Button>]}>
            <List.Item.Meta title={resource.title} description={<><Tag color={STORAGE_META[resource.storageType].color}>{STORAGE_META[resource.storageType].label}</Tag>{resource.sourceLine || resource.providerName}</>} />
          </List.Item>} />
          : <Empty className="media-resource-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合筛选条件的资源" />}
      </>
      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网盘资源" />

  const playableContent = loading && activeMode === 'playable'
    ? <div className="media-resource-loading"><Spin /></div>
    : playableResults?.length
      ? <List className="media-resource-list" dataSource={playableResults} renderItem={(resource) => <List.Item actions={[<Button key="play" type="link" icon={<PlayCircleOutlined />} onClick={() => openPlayable(resource)}>播放</Button>]}>
        <List.Item.Meta title={resource.title} description={<><Tag>{resource.type === 'hls' ? 'HLS' : '直连'}</Tag>{resource.providerName}</>} />
      </List.Item>} />
      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={playableMessage || '暂无在线播放资源'} />

  return <Drawer title={title} width={620} open={open} onClose={onClose} destroyOnClose>
    <Typography.Text type="secondary">选择可用资源</Typography.Text>
    <Tabs activeKey={activeMode} onChange={changeMode} items={[
      { key: 'pan', label: <span><CloudDownloadOutlined />网盘资源</span>, children: panContent },
      { key: 'playable', label: <span><PlayCircleOutlined />在线播放</span>, children: playableContent },
    ]} />
  </Drawer>
}
