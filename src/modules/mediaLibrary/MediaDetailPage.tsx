import { App, Button, Empty, InputNumber, Select, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CloudDownloadOutlined, ExportOutlined, PlayCircleOutlined, StarFilled } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import VideoPlayer from '../videoPlayer/VideoPlayer'
import { mediaLibraryApi } from './api'
import MediaPoster from './MediaPoster'
import { MediaThemeProvider, MediaThemeToggle, useMediaTheme } from './MediaTheme'
import { episodeLabel, episodeLimit, isEpisodeAvailable } from './episode'
import ResourceDrawer from './ResourceDrawer'
import type { MediaItem, PlayableResource } from './types'

export default function MediaDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const { darkMode, setDarkMode } = useMediaTheme()
  const playerRef = useRef<HTMLElement>(null)
  const playableSearchSequenceRef = useRef(0)
  const [item, setItem] = useState<MediaItem>()
  const [loading, setLoading] = useState(true)
  const [episode, setEpisode] = useState(() => {
    const value = Number(searchParams.get('episode'))
    return Number.isSafeInteger(value) && value > 0 && value <= 9999 ? value : 1
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [playableLoading, setPlayableLoading] = useState(false)
  const [playableResults, setPlayableResults] = useState<PlayableResource[]>([])
  const [failedPlayableUrls, setFailedPlayableUrls] = useState<string[]>([])
  const [activePlayableId, setActivePlayableId] = useState('')
  const [playingEpisode, setPlayingEpisode] = useState<number>()
  const [playerReloadKey, setPlayerReloadKey] = useState(0)

  useEffect(() => {
    const mediaId = Number(id)
    if (!Number.isSafeInteger(mediaId)) { setLoading(false); return }
    mediaLibraryApi.get(mediaId).then(setItem).catch((error) => message.error((error as Error).message)).finally(() => setLoading(false))
  }, [id, message])

  const selectEpisode = (value: number) => {
    const safeValue = Number.isSafeInteger(value) && value > 0 ? Math.min(value, 9999) : 1
    setEpisode(safeValue)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('episode', String(safeValue))
    setSearchParams(nextParams, { replace: true })
    return safeValue
  }

  const openPanResources = (nextEpisode?: number) => {
    if (nextEpisode && nextEpisode !== episode) selectEpisode(nextEpisode)
    setDrawerOpen(true)
  }

  const playOnline = async (nextEpisode?: number) => {
    if (!item) return
    const targetEpisode = item.mediaType === 'tv' ? (nextEpisode || episode) : undefined
    const searchSequence = ++playableSearchSequenceRef.current
    setPlayableLoading(true)
    try {
      const output = await mediaLibraryApi.searchPlayable(item.id, targetEpisode)
      if (searchSequence !== playableSearchSequenceRef.current) return
      setPlayableResults(output.results)
      setFailedPlayableUrls([])
      const first = output.results[0]
      setActivePlayableId(first?.id || '')
      setPlayingEpisode(first ? targetEpisode : undefined)
      setPlayerReloadKey((value) => value + 1)
      if (!first) message.warning(output.message || '暂无在线播放资源')
      requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    } catch (error) {
      if (searchSequence !== playableSearchSequenceRef.current) return
      setPlayableResults([])
      setActivePlayableId('')
      message.error((error as Error).message)
    } finally {
      if (searchSequence === playableSearchSequenceRef.current) setPlayableLoading(false)
    }
  }

  const selectAndPlayEpisode = (value: number) => {
    const safeValue = selectEpisode(value)
    void playOnline(safeValue)
  }

  const activePlayable = playableResults.find((resource) => resource.id === activePlayableId)
  const availablePlayableResults = useMemo(() => playableResults.filter((resource) => !failedPlayableUrls.includes(resource.url)), [failedPlayableUrls, playableResults])
  const sourceOptions = useMemo(() => availablePlayableResults.map((resource, index) => ({
    value: resource.id,
    label: availablePlayableResults.length === 1 ? resource.providerName : `${resource.providerName} · 线路${index + 1}`,
    title: resource.title,
  })), [availablePlayableResults])

  const handlePlaybackError = useCallback((failedSource: string) => {
    const failed = new Set([...failedPlayableUrls, failedSource])
    setFailedPlayableUrls([...failed])
    const failedIndex = playableResults.findIndex((resource) => resource.url === failedSource)
    const orderedCandidates = failedIndex >= 0
      ? [...playableResults.slice(failedIndex + 1), ...playableResults.slice(0, failedIndex)]
      : playableResults
    const next = orderedCandidates.find((resource) => !failed.has(resource.url))
    if (!next) {
      message.error('当前浏览器无法播放已找到的线路')
      return
    }
    setActivePlayableId(next.id)
    setPlayerReloadKey((key) => key + 1)
    message.warning(`当前线路不可用，已自动切换至${next.providerName}`)
  }, [failedPlayableUrls, message, playableResults])

  const themeToggle = <MediaThemeToggle darkMode={darkMode} onChange={setDarkMode} />
  if (loading) return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}><SystemHeader actions={themeToggle} /><main className="media-library-loading"><Spin size="large" /></main><SystemFooter /></div></MediaThemeProvider>
  if (!item) return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}><SystemHeader actions={themeToggle} /><main className="media-library-loading"><Empty description="影片不存在" /></main><SystemFooter /></div></MediaThemeProvider>

  const selectableEpisodeCount = item.mediaType === 'tv' ? episodeLimit(item) : null
  const episodes = selectableEpisodeCount ? Array.from({ length: selectableEpisodeCount }, (_, index) => index + 1) : []
  return <MediaThemeProvider darkMode={darkMode}><div className={`media-library-page${darkMode ? ' is-dark' : ''}`}>
    <SystemHeader actions={themeToggle} />
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
            <Button type="primary" icon={<PlayCircleOutlined />} loading={playableLoading} onClick={() => void playOnline()}>在线播放</Button>
            <Button icon={<CloudDownloadOutlined />} onClick={() => openPanResources()}>网盘资源</Button>
          </div>}
        </div>
      </section>

      {item.mediaType === 'tv' && <section className="media-detail-episodes">
        <Typography.Title level={3}>选集</Typography.Title>
        {episodes.length
          ? <div className="media-episode-grid">{episodes.map((number) => <Button key={number} type={episode === number ? 'primary' : 'default'} disabled={!isEpisodeAvailable(item, number)} title={isEpisodeAvailable(item, number) ? `第 ${number} 集` : '尚未更新'} onClick={() => selectAndPlayEpisode(number)}>{number}</Button>)}</div>
          : <InputNumber min={1} max={9999} value={episode} onChange={(value) => selectAndPlayEpisode(value || 1)} aria-label="集数" addonBefore="第" addonAfter="集" />}
        <div className="media-detail-actions">
          <Button type="primary" icon={<PlayCircleOutlined />} loading={playableLoading} onClick={() => void playOnline(episode)}>在线播放</Button>
          <Button icon={<CloudDownloadOutlined />} onClick={() => openPanResources(episode)}>网盘资源</Button>
        </div>
      </section>}

      <section ref={playerRef} className={`media-detail-player${playableLoading ? ' is-searching' : ''}`}>
        <VideoPlayer
          source={activePlayable?.url}
          title={`${item.title}${playingEpisode ? ` 第${String(playingEpisode).padStart(2, '0')}集` : ''}`}
          mode={activePlayable?.type || 'auto'}
          reloadKey={playerReloadKey}
          onPlaybackError={handlePlaybackError}
          topRightContent={sourceOptions.length ? <Select
            className="video-player-source-select"
            value={activePlayableId}
            options={sourceOptions}
            aria-label="切换播放源"
            title={activePlayable?.title}
            popupMatchSelectWidth={false}
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
            onChange={(value) => { setActivePlayableId(value); setPlayerReloadKey((key) => key + 1) }}
          /> : undefined}
        />
        {playableLoading && <div className="media-detail-player-searching"><Spin /></div>}
      </section>
    </main>
    <SystemFooter />
    <ResourceDrawer item={item} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </div></MediaThemeProvider>
}
