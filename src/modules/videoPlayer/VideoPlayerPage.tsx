import { useState } from 'react'
import { App, Button, Input, Segmented, Typography } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'
import VideoPlayer, { type PlaybackMode } from './VideoPlayer'

function cleanMediaName(value: string) {
  const decoded = (() => {
    try { return decodeURIComponent(value) } catch { return value }
  })()
  return decoded.replace(/\.(?:m3u8|mp4|webm|mov|m4v|ogg|ogv)$/i, '').trim().slice(0, 160)
}

function mediaNameFromUrl(value: string) {
  try {
    const url = new URL(value)
    for (const key of ['title', 'name', 'filename']) {
      const candidate = cleanMediaName(url.searchParams.get(key) || '')
      if (candidate) return candidate
    }
    return cleanMediaName(url.pathname.split('/').filter(Boolean).pop() || '')
  } catch {
    return ''
  }
}

export default function VideoPlayerPage() {
  const [searchParams] = useSearchParams()
  const { message } = App.useApp()
  const initialSource = searchParams.get('src') || ''
  const [source, setSource] = useState(initialSource)
  const [activeSource, setActiveSource] = useState(initialSource)
  const [reloadKey, setReloadKey] = useState(0)
  const [mode, setMode] = useState<PlaybackMode>(() => {
    const value = searchParams.get('mode')
    return value === 'hls' || value === 'direct' ? value : 'auto'
  })
  const isPresentationReceiver = searchParams.get('presentation') === '1'
  const queryTitle = searchParams.get('title')?.trim() || ''
  const mediaName = queryTitle === '视频播放器' ? '' : queryTitle || mediaNameFromUrl(activeSource)

  const load = () => {
    if (!source.trim()) {
      message.warning('请输入播放地址')
      return
    }
    setActiveSource(source.trim())
    setReloadKey((value) => value + 1)
  }

  return <div className={`video-player-page${isPresentationReceiver ? ' is-presentation-receiver' : ''}`}>
    {!isPresentationReceiver && <SystemHeader />}
    <main className="video-player-main">
      {mediaName && <section className="video-player-heading"><div className="video-player-title"><Typography.Title level={2}>{mediaName}</Typography.Title></div></section>}
      <VideoPlayer source={activeSource} title={mediaName} mode={mode} reloadKey={reloadKey} presentationReceiver={isPresentationReceiver} />
      {!isPresentationReceiver && <section className="video-player-controls">
        <div className="video-player-mode-row">
          <Segmented<PlaybackMode> value={mode} options={[{ label: '自动', value: 'auto' }, { label: 'HLS', value: 'hls' }, { label: '直连', value: 'direct' }]} onChange={setMode} />
        </div>
        <div className="video-player-source-row">
          <Input size="large" value={source} allowClear placeholder="输入 HTTPS 视频地址，例如 https://media.w3.org/2010/05/sintel/trailer.mp4" onChange={(event) => setSource(event.target.value)} onPressEnter={load} />
          <Button size="large" type="primary" icon={<PlayCircleOutlined />} onClick={load}>加载</Button>
        </div>
        <div className="video-player-actions"><Typography.Text className="video-player-direct-note" type="secondary">媒体由浏览器直连源站 · 播放控制位于画面内</Typography.Text></div>
      </section>}
    </main>
    {!isPresentationReceiver && <SystemFooter />}
  </div>
}
