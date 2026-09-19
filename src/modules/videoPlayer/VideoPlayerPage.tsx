import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Input, Segmented, Tooltip, Typography } from 'antd'
import {
  DesktopOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  MutedOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import type HlsType from 'hls.js'
import { useSearchParams } from 'react-router-dom'
import { SystemFooter, SystemHeader } from '../../platform/layout/SystemChrome'

type PresentationConnectionLike = {
  close: () => void
  terminate?: () => void
  addEventListener?: (type: 'close' | 'terminate', listener: () => void) => void
  onclose?: (() => void) | null
}

type PresentationRequestLike = { start: () => Promise<PresentationConnectionLike> }

function getPresentationRequest() {
  const Constructor = (window as Window & { PresentationRequest?: new (url: string) => PresentationRequestLike }).PresentationRequest
  return Constructor
}

type PlaybackMode = 'auto' | 'hls' | 'direct'
type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

function normalizeMediaUrl(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 HTTP 或 HTTPS 播放地址')
  if (url.username || url.password) throw new Error('播放地址不能包含用户名或密码')
  return url.href
}

function looksLikeHls(url: string) {
  return new URL(url).pathname.toLowerCase().endsWith('.m3u8') || url.toLowerCase().includes('.m3u8?')
}

function cleanMediaName(value: string) {
  const decoded = (() => {
    try { return decodeURIComponent(value) } catch { return value }
  })()
  return decoded.replace(/\.(?:m3u8|mp4|webm|mov|m4v|ogg|ogv)$/i, '').trim().slice(0, 160)
}

function mediaNameFromUrl(value: string) {
  const url = new URL(value)
  for (const key of ['title', 'name', 'filename']) {
    const candidate = cleanMediaName(url.searchParams.get(key) || '')
    if (candidate) return candidate
  }
  const fileName = url.pathname.split('/').filter(Boolean).pop() || ''
  return cleanMediaName(fileName)
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const minuteText = hours ? String(minutes).padStart(2, '0') : String(minutes)
  return `${hours ? `${hours}:` : ''}${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function VideoPlayerPage() {
  const [searchParams] = useSearchParams()
  const { message } = App.useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const hlsRef = useRef<HlsType>()
  const loadSequenceRef = useRef(0)
  const autoPlayPendingRef = useRef(false)
  const [source, setSource] = useState(() => searchParams.get('src') || '')
  const [activeSource, setActiveSource] = useState('')
  const [mediaName, setMediaName] = useState('')
  const [mode, setMode] = useState<PlaybackMode>(() => {
    const value = searchParams.get('mode')
    return value === 'hls' || value === 'direct' ? value : 'auto'
  })
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [presentation, setPresentation] = useState<PresentationConnectionLike>()
  const presentationRef = useRef<PresentationConnectionLike>()
  const isPresentationReceiver = searchParams.get('presentation') === '1'

  useEffect(() => () => {
    const connection = presentationRef.current
    if (!connection) return
    try {
      if (connection.terminate) connection.terminate()
      else connection.close()
    } catch {
      connection.close()
    }
  }, [])

  const resetVideo = useCallback(() => {
    loadSequenceRef.current += 1
    hlsRef.current?.destroy()
    hlsRef.current = undefined
    const video = videoRef.current
    if (!video) return
    video.pause()
    autoPlayPendingRef.current = false
    video.removeAttribute('src')
    video.load()
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const loadSource = useCallback(async (rawSource = source, preferredName = '') => {
    let mediaUrl: string
    try {
      mediaUrl = normalizeMediaUrl(rawSource)
    } catch (loadError) {
      const text = rawSource.trim() ? (loadError as Error).message : '请输入播放地址'
      setError(text)
      setStatus('error')
      message.warning(text)
      return
    }

    const video = videoRef.current
    if (!video) return
    resetVideo()
    autoPlayPendingRef.current = true
    const loadSequence = loadSequenceRef.current
    setSource(mediaUrl)
    setActiveSource(mediaUrl)
    setMediaName(cleanMediaName(preferredName) || mediaNameFromUrl(mediaUrl))
    setError('')
    setStatus('loading')

    const useHls = mode === 'hls' || (mode === 'auto' && looksLikeHls(mediaUrl))
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')
    if (useHls) {
      const { default: Hls, ErrorTypes } = await import('hls.js')
      if (loadSequence !== loadSequenceRef.current || video !== videoRef.current) return
      if (!Hls.isSupported() && !nativeHls) {
        setError('当前浏览器不支持此 HLS 播放源')
        setStatus('error')
        return
      }
      if (!Hls.isSupported()) {
        video.src = mediaUrl
        video.load()
        return
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 })
      hlsRef.current = hls
      hls.attachMedia(video)
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(mediaUrl))
      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('ready'))
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        if (data.type === ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }
        setError(data.type === ErrorTypes.NETWORK_ERROR
          ? '无法读取视频分片，请检查播放源跨域设置或地址有效期'
          : '当前播放源无法解码')
        setStatus('error')
      })
      return
    }
    video.src = mediaUrl
    video.load()
  }, [message, mode, resetVideo, source])

  useEffect(() => {
    const initialSource = searchParams.get('src')
    const initialName = searchParams.get('title')?.trim()
    if (initialSource) void loadSource(initialSource, initialName === '视频播放器' ? '' : initialName)
    return resetVideo
    // Initial query parameters are intentionally consumed only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopPresentation = () => {
    const connection = presentationRef.current
    if (!connection) return
    // terminate() stops the presentation itself; close() is the compatibility
    // fallback for browsers exposing only the connection-close operation.
    try {
      if (connection.terminate) connection.terminate()
      else connection.close()
    } catch {
      connection.close()
    }
    presentationRef.current = undefined
    setPresentation(undefined)
    message.success('已退出投屏')
  }

  const enterFullscreen = async () => {
    const stage = stageRef.current
    if (!stage) return
    try {
      await stage.requestFullscreen()
    } catch {
      message.warning('浏览器未允许进入全屏')
    }
  }

  const togglePlayback = async () => {
    const player = videoRef.current
    if (!player || !activeSource) return
    if (player.paused) {
      try {
        await player.play()
      } catch {
        message.warning('浏览器未允许开始播放')
      }
    } else {
      player.pause()
    }
  }

  const seekVideo = (value: number) => {
    const player = videoRef.current
    if (!player || !Number.isFinite(player.duration)) return
    player.currentTime = value
    setCurrentTime(value)
  }

  const changeVolume = (value: number) => {
    const player = videoRef.current
    if (!player) return
    player.volume = value
    player.muted = value === 0
    setVolume(value)
    setMuted(value === 0)
  }

  const toggleMuted = () => {
    const player = videoRef.current
    if (!player) return
    player.muted = !player.muted
    setMuted(player.muted)
  }

  const changePlaybackRate = (value: number) => {
    const player = videoRef.current
    if (player) {
      player.defaultPlaybackRate = value
      player.playbackRate = value
    }
    setPlaybackRate(value)
  }

  const replayVideo = async () => {
    const player = videoRef.current
    if (!player || !activeSource) {
      message.warning('请先加载视频')
      return
    }
    if (presentation) {
      message.info('视频正在投屏，请先退出投屏')
      return
    }
    player.currentTime = 0
    try {
      await player.play()
    } catch {
      setStatus('ready')
    }
  }

  const presentVideo = async () => {
    if (!activeSource) { message.warning('请先加载视频'); return }
    const PresentationRequest = getPresentationRequest()
    if (!PresentationRequest) {
      message.info('当前浏览器不支持网络投屏，请使用支持 Presentation API 的浏览器或系统投屏功能')
      return
    }
    try {
      const query = new URLSearchParams({ src: activeSource, mode })
      if (mediaName) query.set('title', mediaName)
      const connection = await new PresentationRequest(`${window.location.origin}/video-player?${query.toString()}&presentation=1`).start()
      const handleConnectionClosed = () => {
        presentationRef.current = undefined
        setPresentation(undefined)
      }
      connection.onclose = handleConnectionClosed
      connection.addEventListener?.('close', handleConnectionClosed)
      connection.addEventListener?.('terminate', handleConnectionClosed)
      presentationRef.current = connection
      setPresentation(connection)
      // Keep playback exclusively on the receiving device after the connection
      // is established. The local player remains paused until the user exits.
      videoRef.current?.pause()
      message.success('已连接投屏设备，视频将由设备直接请求源站')
    } catch (presentError) {
      if ((presentError as Error).name !== 'AbortError') message.error('未能连接投屏设备，请确认设备与本机在同一网络')
    }
  }

  return <div className={`video-player-page${isPresentationReceiver ? ' is-presentation-receiver' : ''}`}>
    {!isPresentationReceiver && <SystemHeader />}

    <main className="video-player-main">
      {mediaName && <section className="video-player-heading">
        <div className="video-player-title"><Typography.Title level={2}>{mediaName}</Typography.Title></div>
      </section>}

      <section ref={stageRef} className="video-player-stage" aria-label="视频播放区域">
        <video
          ref={videoRef}
          controls={isPresentationReceiver}
          playsInline
          preload="metadata"
          onCanPlay={(event) => {
            setStatus('ready')
            if (!isPresentationReceiver && !autoPlayPendingRef.current) return
            const player = event.currentTarget
            void player.play().then(() => {
              autoPlayPendingRef.current = false
            }).catch(() => {
              autoPlayPendingRef.current = false
              if (isPresentationReceiver) {
                setError('接收设备阻止了自动播放，请点击视频开始播放')
              } else {
                message.warning('浏览器阻止了自动播放，请点击播放按钮')
              }
            })
          }}
          onPlay={() => {
            autoPlayPendingRef.current = false
            setStatus('playing')
          }}
          onPause={() => (videoRef.current?.getAttribute('src') || hlsRef.current) && setStatus('paused')}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume)
            setMuted(event.currentTarget.muted)
          }}
          onWaiting={() => setStatus('loading')}
          onError={() => {
            if (hlsRef.current || !activeSource) return
            setError('视频加载失败，请确认地址有效且源站允许浏览器直接访问')
            setStatus('error')
          }}
        />
        {!activeSource && <div className="video-player-placeholder" aria-hidden="true"><PlayCircleOutlined /></div>}
        {presentation && <div className="video-player-presented-message" role="status" aria-live="polite">
          <DesktopOutlined />
          <strong>视频已投屏</strong>
          <span>当前设备已暂停播放</span>
        </div>}
        {status === 'loading' && !presentation && <div className="video-player-loading" aria-live="polite"><span /></div>}
        {!isPresentationReceiver && <div className="video-player-overlay-actions" aria-label="播放器操作">
          <Tooltip title={presentation ? '退出投屏' : '投屏'}><Button type="text" shape="circle" icon={presentation ? <DisconnectOutlined /> : <DesktopOutlined />} disabled={!activeSource} onClick={() => (presentation ? stopPresentation() : void presentVideo())} /></Tooltip>
        </div>}
        {!isPresentationReceiver && !presentation && <div className="video-player-bottom-controls" aria-label="播放控制">
          <Tooltip title="重播"><Button type="text" shape="circle" icon={<ReloadOutlined />} disabled={!activeSource} onClick={() => void replayVideo()} /></Tooltip>
          <Tooltip title={status === 'playing' ? '暂停' : '播放'}><Button type="text" shape="circle" icon={status === 'playing' ? <PauseCircleOutlined /> : <PlayCircleOutlined />} disabled={!activeSource} onClick={() => void togglePlayback()} /></Tooltip>
          <span className="video-player-time">{formatPlaybackTime(currentTime)}</span>
          <input className="video-player-progress" type="range" min={0} max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} aria-label="播放进度" onChange={(event) => seekVideo(Number(event.target.value))} />
          <span className="video-player-time">{formatPlaybackTime(duration)}</span>
          <Tooltip title={muted ? '取消静音' : '静音'}><Button type="text" shape="circle" icon={muted || volume === 0 ? <MutedOutlined /> : <SoundOutlined />} disabled={!activeSource} onClick={toggleMuted} /></Tooltip>
          <input className="video-player-volume" type="range" min={0} max={1} step="0.05" value={muted ? 0 : volume} disabled={!activeSource} aria-label="音量" onChange={(event) => changeVolume(Number(event.target.value))} />
          <Tooltip title="下载当前播放源"><Button type="text" shape="circle" icon={<DownloadOutlined />} href={activeSource || undefined} download target="_blank" rel="noopener noreferrer" disabled={!activeSource} /></Tooltip>
          <select className="video-player-rate" value={playbackRate} disabled={!activeSource} aria-label="播放速度" title="播放速度" onChange={(event) => changePlaybackRate(Number(event.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          <Tooltip title="全屏"><Button type="text" shape="circle" icon={<FullscreenOutlined />} disabled={!activeSource} onClick={() => void enterFullscreen()} /></Tooltip>
        </div>}
      </section>

      {!isPresentationReceiver && <section className="video-player-controls">
        <div className="video-player-mode-row">
          <Segmented<PlaybackMode>
            value={mode}
            options={[{ label: '自动', value: 'auto' }, { label: 'HLS', value: 'hls' }, { label: '直连', value: 'direct' }]}
            onChange={setMode}
          />
        </div>
        <div className="video-player-source-row">
          <Input
            size="large"
            value={source}
            allowClear
            placeholder="输入 HTTPS 视频地址，例如 https://media.w3.org/2010/05/sintel/trailer.mp4"
            onChange={(event) => setSource(event.target.value)}
            onPressEnter={() => void loadSource()}
          />
          <Button size="large" type="primary" icon={<PlayCircleOutlined />} onClick={() => void loadSource()}>加载</Button>
        </div>
        <div className="video-player-actions">
          <Typography.Text className="video-player-direct-note" type="secondary">媒体由浏览器直连源站 · 播放控制位于画面内</Typography.Text>
        </div>
        {error && <div className="video-player-error" role="alert">{error}</div>}
      </section>}
    </main>
    {!isPresentationReceiver && <SystemFooter />}
  </div>
}
