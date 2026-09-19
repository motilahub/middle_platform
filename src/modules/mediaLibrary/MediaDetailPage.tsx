import { App, Button, Empty, InputNumber, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CloudDownloadOutlined, ExportOutlined, PlayCircleOutlined, StarFilled } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import { mediaLibraryApi } from './api'
import MediaPoster from './MediaPoster'
import { episodeLabel, episodeLimit, isEpisodeAvailable } from './episode'
import ResourceDrawer from './ResourceDrawer'
import type { MediaItem } from './types'

type ResourceMode = 'pan' | 'playable'

export default function MediaDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { message } = App.useApp()
  const [item, setItem] = useState<MediaItem>()
  const [loading, setLoading] = useState(true)
  const [episode, setEpisode] = useState(1)
  const [drawerMode, setDrawerMode] = useState<ResourceMode>('pan')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const mediaId = Number(id)
    if (!Number.isSafeInteger(mediaId)) { setLoading(false); return }
    mediaLibraryApi.get(mediaId).then(setItem).catch((error) => message.error((error as Error).message)).finally(() => setLoading(false))
  }, [id, message])

  const openResources = (mode: ResourceMode, nextEpisode?: number) => {
    setEpisode(nextEpisode || episode)
    setDrawerMode(mode)
    setDrawerOpen(true)
  }

  if (loading) return <div className="media-library-page"><SystemHeader /><main className="media-library-loading"><Spin size="large" /></main><SystemFooter /></div>
  if (!item) return <div className="media-library-page"><SystemHeader /><main className="media-library-loading"><Empty description="影片不存在" /></main><SystemFooter /></div>

  const selectableEpisodeCount = item.mediaType === 'tv' ? episodeLimit(item) : null
  const episodes = selectableEpisodeCount ? Array.from({ length: selectableEpisodeCount }, (_, index) => index + 1) : []
  return <div className="media-library-page">
    <SystemHeader />
    <main className="media-detail-main">
      <Button className="media-detail-back" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/media-library')}>返回影视库</Button>
      <section className="media-detail-overview">
        <div className="media-detail-poster">
          <MediaPoster item={item} alt={item.title} loading="eager" />
        </div>
        <div className="media-detail-copy">
          <Typography.Title level={1}>{item.title}</Typography.Title>
          <div className="media-detail-meta">
            <span className="media-detail-rating"><StarFilled /> {(item.rating || 0).toFixed(1)}</span>
            {item.year && <Tag>{item.year}</Tag>}
            <Tag>{item.mediaType === 'movie' ? '电影' : '电视剧'}</Tag>
            {item.mediaType === 'tv' && episodeLabel(item) && <Tag>{episodeLabel(item)}</Tag>}
          </div>
          {item.metadata.subtitle && <Typography.Text type="secondary">{item.metadata.subtitle}</Typography.Text>}
          {item.summary && <Typography.Paragraph className="media-detail-summary">{item.summary}</Typography.Paragraph>}
          {item.sourceUrl && <Button className="media-detail-source" type="link" href={item.sourceUrl} target="_blank" rel="noreferrer" icon={<ExportOutlined />}>豆瓣条目</Button>}
          {item.mediaType === 'movie' && <div className="media-detail-actions">
            <Button icon={<CloudDownloadOutlined />} onClick={() => openResources('pan')}>网盘资源</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => openResources('playable')}>在线播放</Button>
          </div>}
        </div>
      </section>

      {item.mediaType === 'tv' && <section className="media-detail-episodes">
        <Typography.Title level={3}>选集</Typography.Title>
        {episodes.length
          ? <div className="media-episode-grid">{episodes.map((number) => <Button key={number} type={episode === number ? 'primary' : 'default'} disabled={!isEpisodeAvailable(item, number)} title={isEpisodeAvailable(item, number) ? `第 ${number} 集` : '尚未更新'} onClick={() => setEpisode(number)}>{number}</Button>)}</div>
          : <InputNumber min={1} max={9999} value={episode} onChange={(value) => setEpisode(value || 1)} aria-label="集数" addonBefore="第" addonAfter="集" />}
        <div className="media-detail-actions">
          <Button icon={<CloudDownloadOutlined />} onClick={() => openResources('pan', episode)}>网盘资源</Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => openResources('playable', episode)}>在线播放</Button>
        </div>
      </section>}
    </main>
    <SystemFooter />
    <ResourceDrawer item={item} episode={item.mediaType === 'tv' ? episode : undefined} mode={drawerMode} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </div>
}
