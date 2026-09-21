import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Popover, Slider } from 'antd'
import {
  DesktopOutlined,
  DisconnectOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LockOutlined,
  MutedFilled,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ShareAltOutlined,
  SoundFilled,
  StepBackwardOutlined,
  StepForwardOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import type HlsType from 'hls.js'

type PresentationConnectionLike = {
  close: () => void
  terminate?: () => void
  addEventListener?: (type: 'close' | 'terminate', listener: () => void) => void
  onclose?: (() => void) | null
}

type PresentationRequestLike = { start: () => Promise<PresentationConnectionLike> }
type SafariDocument = Document & {
  webkitExitFullscreen?: () => void | Promise<void>
  webkitFullscreenElement?: Element | null
}
type SafariFullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> }
type SafariVideoElement = HTMLVideoElement & {
  webkitCurrentPlaybackTargetIsWireless?: boolean
  webkitDisplayingFullscreen?: boolean
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitShowPlaybackTargetPicker?: () => void
}
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape' | 'portrait') => Promise<void> }

export type PlaybackMode = 'auto' | 'hls' | 'direct'
type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'
type BufferedRange = { start: number; end: number }
type TouchAdjustment = 'brightness' | 'volume'
type GestureFeedback = { label: string; value?: number }
type PointerGesture = {
  pointerId: number
  startX: number
  startY: number
  startBrightness: number
  startVolume: number
  adjustment?: TouchAdjustment
  moved: boolean
}

export interface VideoPlayerProps {
  source?: string
  title?: string
  showTitleOverlay?: boolean
  mode?: PlaybackMode
  autoPlay?: boolean
  reloadKey?: number
  resumeKey?: string
  sourceKey?: string
  presentationReceiver?: boolean
  topRightContent?: ReactNode
  sideContent?: ReactNode
  onPlaybackError?: (source: string, message: string) => void
  onEnded?: () => void
  onPreviousEpisode?: () => void
  onNextEpisode?: () => void
  canPreviousEpisode?: boolean
  canNextEpisode?: boolean
}

function getPresentationRequest() {
  return (window as Window & { PresentationRequest?: new (url: string) => PresentationRequestLike }).PresentationRequest
}

function fullscreenElement() {
  const safariDocument = document as SafariDocument
  return document.fullscreenElement || safariDocument.webkitFullscreenElement || null
}

function usesNativeSafariFullscreen() {
  return /iP(?:ad|hone|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function normalizeMediaUrl(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 HTTP 或 HTTPS 播放地址')
  if (url.username || url.password) throw new Error('播放地址不能包含用户名或密码')
  return url.href
}

function looksLikeHls(url: string) {
  return new URL(url).pathname.toLowerCase().endsWith('.m3u8') || url.toLowerCase().includes('.m3u8?')
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const minuteText = hours ? String(minutes).padStart(2, '0') : String(minutes)
  return `${hours ? `${hours}:` : ''}${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function VideoPlayer({
  source = '',
  title = '',
  showTitleOverlay = false,
  mode = 'auto',
  autoPlay = true,
  reloadKey = 0,
  resumeKey,
  sourceKey,
  presentationReceiver = false,
  topRightContent,
  sideContent,
  onPlaybackError,
  onEnded,
  onPreviousEpisode,
  onNextEpisode,
  canPreviousEpisode = false,
  canNextEpisode = false,
}: VideoPlayerProps) {
  const { message } = App.useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const hlsRef = useRef<HlsType>()
  const loadSequenceRef = useRef(0)
  const autoPlayPendingRef = useRef(false)
  const presentationRef = useRef<PresentationConnectionLike>()
  const videoClickTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const onPlaybackErrorRef = useRef(onPlaybackError)
  const onEndedRef = useRef(onEnded)
  const reportedErrorSourceRef = useRef('')
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastLoadedSourceRef = useRef<{ source: string; key: string; sourceKey?: string }>()
  const lastPlaybackPositionRef = useRef(0)
  const pendingResumeRef = useRef<number>()
  const orientationLockedRef = useRef(false)
  const screenLockedRef = useRef(false)
  const pointerGestureRef = useRef<PointerGesture>()
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const longPressRateRef = useRef<number>()
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const suppressVideoClickRef = useRef(false)
  const [activeSource, setActiveSource] = useState('')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedRanges, setBufferedRanges] = useState<BufferedRange[]>([])
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [presentation, setPresentation] = useState<PresentationConnectionLike>()
  const [airPlayConnected, setAirPlayConnected] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [screenLocked, setScreenLocked] = useState(false)
  const [brightness, setBrightness] = useState(1)
  const [gestureFeedback, setGestureFeedback] = useState<GestureFeedback>()

  useEffect(() => {
    onPlaybackErrorRef.current = onPlaybackError
  }, [onPlaybackError])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  const resetVideo = useCallback(() => {
    loadSequenceRef.current += 1
    hlsRef.current?.destroy()
    hlsRef.current = undefined
    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    autoPlayPendingRef.current = false
    setActiveSource('')
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBufferedRanges([])
  }, [])

  const reportPlaybackError = useCallback((sourceUrl: string, text: string) => {
    if (reportedErrorSourceRef.current === sourceUrl) return
    reportedErrorSourceRef.current = sourceUrl
    autoPlayPendingRef.current = false
    setIsPlaying(false)
    setError(text)
    setStatus('error')
    onPlaybackErrorRef.current?.(sourceUrl, text)
  }, [])

  const restorePlaybackPosition = useCallback((video: HTMLVideoElement) => {
    const previousTime = pendingResumeRef.current
    if (!previousTime) return
    const seekable = video.seekable
    let target = previousTime
    if (seekable.length) {
      const range = Array.from({ length: seekable.length }, (_, index) => ({ start: seekable.start(index), end: seekable.end(index) }))
        .find(({ start, end }) => previousTime >= start && previousTime <= end)
      const nearest = range || (previousTime < seekable.start(0)
        ? { start: seekable.start(0), end: seekable.end(0) }
        : { start: seekable.start(seekable.length - 1), end: seekable.end(seekable.length - 1) })
      target = Math.max(nearest.start, Math.min(previousTime, Math.max(nearest.start, nearest.end - 0.5)))
    } else if (Number.isFinite(video.duration) && video.duration > 0) {
      target = Math.min(previousTime, Math.max(0, video.duration - 0.5))
    } else return
    try {
      video.currentTime = target
      pendingResumeRef.current = undefined
      setCurrentTime(target)
    } catch {
      // Some HLS sources expose seekable ranges only after the first segment arrives.
    }
  }, [])

  const loadSource = useCallback(async (rawSource: string) => {
    let mediaUrl: string
    try {
      mediaUrl = normalizeMediaUrl(rawSource)
    } catch (loadError) {
      const text = rawSource.trim() ? (loadError as Error).message : ''
      resetVideo()
      setError(text)
      setStatus(text ? 'error' : 'idle')
      return
    }

    const video = videoRef.current
    if (!video) return
    resetVideo()
    autoPlayPendingRef.current = autoPlay
    const loadSequence = loadSequenceRef.current
    reportedErrorSourceRef.current = ''
    setActiveSource(mediaUrl)
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
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('ready')
        if (!autoPlayPendingRef.current) return
        void video.play().then(() => {
          autoPlayPendingRef.current = false
        }).catch(() => {
          // onCanPlay retries after the first media segment is buffered.
        })
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (loadSequence !== loadSequenceRef.current) return
        if (!data.fatal) return
        if (data.type === ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }
        reportPlaybackError(mediaUrl, data.type === ErrorTypes.NETWORK_ERROR
          ? '无法读取视频分片，请检查播放源跨域设置或地址有效期'
          : '当前播放源无法解码')
      })
      return
    }
    video.src = mediaUrl
    video.load()
  }, [autoPlay, mode, reportPlaybackError, resetVideo])

  useEffect(() => {
    const previous = lastLoadedSourceRef.current
    const previousTime = videoRef.current?.currentTime
    const resumeTime = typeof previousTime === 'number' && Number.isFinite(previousTime) && (previousTime > 0 || !videoRef.current?.error)
      ? previousTime : lastPlaybackPositionRef.current
    pendingResumeRef.current = resumeKey && source && previous?.key === resumeKey && (previous.source !== source || previous.sourceKey !== sourceKey) && !videoRef.current?.ended
      ? resumeTime
      : undefined
    lastLoadedSourceRef.current = resumeKey && source ? { source, key: resumeKey, sourceKey } : undefined
    lastPlaybackPositionRef.current = 0
    if (source) void loadSource(source)
    else {
      resetVideo()
      setError('')
      setStatus('idle')
    }
  }, [loadSource, reloadKey, resetVideo, resumeKey, source, sourceKey])

  useEffect(() => () => {
    if (videoClickTimerRef.current) clearTimeout(videoClickTimerRef.current)
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current)
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    const connection = presentationRef.current
    if (connection) {
      try {
        if (connection.terminate) connection.terminate()
        else connection.close()
      } catch {
        connection.close()
      }
    }
    hlsRef.current?.destroy()
    if (orientationLockedRef.current) {
      orientationLockedRef.current = false
      try { screen.orientation?.unlock() } catch { /* Browser may already have released the lock. */ }
    }
  }, [])

  const releaseOrientation = useCallback(() => {
    if (!orientationLockedRef.current) return
    orientationLockedRef.current = false
    try { screen.orientation?.unlock() } catch { /* Browser may already have released the lock. */ }
  }, [])

  const unlockScreen = useCallback(() => {
    screenLockedRef.current = false
    setScreenLocked(false)
    releaseOrientation()
  }, [releaseOrientation])

  const keepControlsVisible = useCallback(() => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current)
    setControlsVisible(true)
  }, [])

  useEffect(() => {
    const video = videoRef.current as SafariVideoElement | null
    if (!video) return
    video.setAttribute('x-webkit-airplay', 'allow')
    const handleAirPlayChange = () => setAirPlayConnected(Boolean(video.webkitCurrentPlaybackTargetIsWireless))
    const handleNativeFullscreenStart = () => setIsFullscreen(true)
    const handleNativeFullscreenEnd = () => { setIsFullscreen(false); unlockScreen(); keepControlsVisible() }
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange)
    video.addEventListener('webkitbeginfullscreen', handleNativeFullscreenStart)
    video.addEventListener('webkitendfullscreen', handleNativeFullscreenEnd)
    return () => {
      video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange)
      video.removeEventListener('webkitbeginfullscreen', handleNativeFullscreenStart)
      video.removeEventListener('webkitendfullscreen', handleNativeFullscreenEnd)
    }
  }, [keepControlsVisible, unlockScreen])

  const scheduleControlsHide = useCallback(() => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current)
    if (screenLockedRef.current) return
    setControlsVisible(true)
    if (videoRef.current?.paused || volumeOpen) return
    controlsHideTimerRef.current = setTimeout(() => {
      controlsHideTimerRef.current = undefined
      if (!videoRef.current?.paused && !volumeOpen && !screenLockedRef.current) setControlsVisible(false)
    }, 5000)
  }, [volumeOpen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = fullscreenElement() === stageRef.current
      setIsFullscreen(fullscreen)
      if (fullscreen) scheduleControlsHide()
      else { unlockScreen(); keepControlsVisible() }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [keepControlsVisible, scheduleControlsHide, unlockScreen])

  useEffect(() => {
    if (isPlaying) scheduleControlsHide()
    else keepControlsVisible()
  }, [isPlaying, keepControlsVisible, scheduleControlsHide])

  const stopPresentation = () => {
    const connection = presentationRef.current
    if (!connection) return
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

  const shareVideo = async () => {
    try {
      await navigator.share({ title: title || document.title, url: window.location.href })
      setShareOpen(false)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') message.error('无法打开系统分享，请尝试复制链接')
    }
  }

  const copyVideoLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareOpen(false)
      message.success('链接已复制')
    } catch {
      message.error('无法复制链接，请使用浏览器地址栏复制')
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

  const toggleFullscreen = async () => {
    const stage = stageRef.current as SafariFullscreenElement | null
    const player = videoRef.current as SafariVideoElement | null
    if (!stage || !player || !activeSource) return
    try {
      const safariDocument = document as SafariDocument
      if (fullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen()
        else await safariDocument.webkitExitFullscreen?.()
        return
      }
      if (player.webkitDisplayingFullscreen) {
        player.webkitExitFullscreen?.()
        return
      }
      if (usesNativeSafariFullscreen() && player.webkitEnterFullscreen) {
        player.webkitEnterFullscreen()
        return
      }
      if (stage.requestFullscreen) {
        await stage.requestFullscreen()
        return
      }
      if (stage.webkitRequestFullscreen) {
        await stage.webkitRequestFullscreen()
        return
      }
      if (player.webkitEnterFullscreen) {
        player.webkitEnterFullscreen()
        return
      }
      throw new Error('Fullscreen API unavailable')
    } catch {
      try {
        if (!isFullscreen && player.webkitEnterFullscreen) {
          player.webkitEnterFullscreen()
          return
        }
      } catch {
        // Continue to the user-facing warning below.
      }
      message.warning(isFullscreen ? '浏览器未允许退出全屏' : '浏览器未允许进入全屏，请直接点击视频后重试')
    }
  }

  const toggleScreenLock = async () => {
    const orientation = screen.orientation as LockableOrientation | undefined
    if (!orientation?.lock) return
    if (screenLockedRef.current) { unlockScreen(); keepControlsVisible(); return }
    if (fullscreenElement() !== stageRef.current) return
    try {
      const currentOrientation = window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
      await orientation.lock(currentOrientation)
      if (fullscreenElement() !== stageRef.current) { orientation.unlock(); return }
      orientationLockedRef.current = true
      screenLockedRef.current = true
      setScreenLocked(true)
      setControlsVisible(false)
    } catch {
      message.info('当前浏览器未允许锁定屏幕方向')
    }
  }

  const handleVideoClick = () => {
    if (screenLockedRef.current) return
    if (suppressVideoClickRef.current) {
      suppressVideoClickRef.current = false
      return
    }
    if (videoClickTimerRef.current) clearTimeout(videoClickTimerRef.current)
    videoClickTimerRef.current = setTimeout(() => {
      videoClickTimerRef.current = undefined
      void togglePlayback()
    }, 220)
  }

  const handleVideoDoubleClick = () => {
    if (videoClickTimerRef.current) {
      clearTimeout(videoClickTimerRef.current)
      videoClickTimerRef.current = undefined
    }
    void toggleFullscreen()
  }

  const presentVideo = async () => {
    if (!activeSource) return
    const PresentationRequest = getPresentationRequest()
    if (!PresentationRequest) {
      const player = videoRef.current as SafariVideoElement | null
      if (player?.webkitShowPlaybackTargetPicker) {
        try {
          player.webkitShowPlaybackTargetPicker()
        } catch {
          message.warning('Safari 未允许打开隔空播放设备，请先点击视频开始播放后重试')
        }
        return
      }
      message.info('当前浏览器不支持网页投屏，请使用浏览器或系统提供的投屏功能')
      return
    }
    try {
      const query = new URLSearchParams({ src: activeSource, mode })
      if (title) query.set('title', title)
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
      videoRef.current?.pause()
      message.success('已连接投屏设备，视频将由设备直接请求源站')
    } catch (presentError) {
      if ((presentError as Error).name !== 'AbortError') message.error('未能连接投屏设备，请确认设备与本机在同一网络')
    }
  }

  const changeVolume = (value: number) => {
    const player = videoRef.current
    if (!player) return
    const normalizedVolume = Math.min(1, Math.max(0, value / 100))
    setVolume(normalizedVolume)
    setMuted(value === 0)
    player.volume = normalizedVolume
    player.muted = value === 0
  }

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = undefined
  }

  const finishPointerGesture = (event: ReactPointerEvent<HTMLVideoElement>) => {
    const gesture = pointerGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    clearLongPressTimer()
    if (longPressRateRef.current !== undefined) {
      if (videoRef.current) videoRef.current.playbackRate = longPressRateRef.current
      longPressRateRef.current = undefined
      suppressVideoClickRef.current = true
    }
    if (gesture.moved) suppressVideoClickRef.current = true
    pointerGestureRef.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setGestureFeedback(undefined), 450)
    setTimeout(() => { suppressVideoClickRef.current = false }, 400)
  }

  const handleVideoPointerDown = (event: ReactPointerEvent<HTMLVideoElement>) => {
    if (!activeSource || presentation || screenLockedRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startBrightness: brightness,
      startVolume: muted ? 0 : volume,
      adjustment: event.clientX < bounds.left + bounds.width / 2 ? 'brightness' : 'volume',
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      const gesture = pointerGestureRef.current
      const player = videoRef.current
      if (!gesture || gesture.moved || !player || player.paused) return
      longPressTimerRef.current = undefined
      longPressRateRef.current = player.playbackRate
      player.playbackRate = 2
      setGestureFeedback({ label: '2倍速播放中' })
    }, 450)
  }

  const handleVideoPointerMove = (event: ReactPointerEvent<HTMLVideoElement>) => {
    const gesture = pointerGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || longPressRateRef.current !== undefined) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    if (!gesture.moved && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return
    gesture.moved = true
    clearLongPressTimer()
    if (Math.abs(deltaY) < Math.abs(deltaX) || !gesture.adjustment) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const change = -deltaY / Math.max(120, bounds.height * 0.65)
    if (gesture.adjustment === 'brightness') {
      const nextBrightness = Math.min(1, Math.max(0.2, gesture.startBrightness + change))
      setBrightness(nextBrightness)
      setGestureFeedback({ label: '亮度', value: Math.round(nextBrightness * 100) })
      return
    }
    const nextVolume = Math.min(1, Math.max(0, gesture.startVolume + change))
    changeVolume(nextVolume * 100)
    setGestureFeedback({ label: '音量', value: Math.round(nextVolume * 100) })
  }

  const syncBufferedRanges = (player: HTMLVideoElement) => {
    const ranges = Array.from({ length: player.buffered.length }, (_, index) => ({
      start: player.buffered.start(index),
      end: player.buffered.end(index),
    }))
    setBufferedRanges(ranges)
  }

  const playedPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const casting = Boolean(presentation) || airPlayConnected
  const supportsScreenLock = !presentationReceiver
    && !usesNativeSafariFullscreen()
    && typeof (screen.orientation as LockableOrientation | undefined)?.lock === 'function'
    && window.matchMedia('(pointer: coarse)').matches

  return <>
    <section
      ref={stageRef}
      className={`video-player-stage${!controlsVisible || screenLocked ? ' is-controls-hidden' : ''}${screenLocked ? ' is-screen-locked' : ''}`}
      aria-label="视频播放区域"
      onMouseMove={scheduleControlsHide}
      onTouchStart={scheduleControlsHide}
      onKeyDown={scheduleControlsHide}
    >
      <video
        ref={videoRef}
        className={activeSource && !presentation && !screenLocked ? 'is-interactive' : undefined}
        style={{ '--video-brightness': brightness } as CSSProperties}
        controls={presentationReceiver}
        playsInline
        preload="metadata"
        onClick={presentationReceiver ? undefined : handleVideoClick}
        onDoubleClick={presentationReceiver ? undefined : handleVideoDoubleClick}
        onPointerDown={presentationReceiver ? undefined : handleVideoPointerDown}
        onPointerMove={presentationReceiver ? undefined : handleVideoPointerMove}
        onPointerUp={presentationReceiver ? undefined : finishPointerGesture}
        onPointerCancel={presentationReceiver ? undefined : finishPointerGesture}
        onLoadedMetadata={(event) => restorePlaybackPosition(event.currentTarget)}
        onCanPlay={(event) => {
          restorePlaybackPosition(event.currentTarget)
          if (event.currentTarget.paused && status !== 'paused') setStatus('ready')
          if (!presentationReceiver && !autoPlayPendingRef.current) return
          void event.currentTarget.play().then(() => {
            autoPlayPendingRef.current = false
          }).catch(() => {
            autoPlayPendingRef.current = false
            if (presentationReceiver) setError('接收设备阻止了自动播放，请点击视频开始播放')
            else message.warning('浏览器阻止了自动播放，请点击播放按钮')
          })
        }}
        onPlay={() => { autoPlayPendingRef.current = false; setIsPlaying(true); setStatus('playing') }}
        onPlaying={() => { setIsPlaying(true); setStatus('playing') }}
        onPause={() => {
          setIsPlaying(false)
          if (videoRef.current?.getAttribute('src') || hlsRef.current) setStatus('paused')
        }}
        onEnded={() => { setIsPlaying(false); setStatus('paused'); if (activeSource && !presentation) onEndedRef.current?.() }}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime
          if (Number.isFinite(time)) lastPlaybackPositionRef.current = time
          setCurrentTime(time)
        }}
        onSeeking={(event) => { lastPlaybackPositionRef.current = event.currentTarget.currentTime }}
        onDurationChange={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
          restorePlaybackPosition(event.currentTarget)
          syncBufferedRanges(event.currentTarget)
        }}
        onProgress={(event) => syncBufferedRanges(event.currentTarget)}
        onVolumeChange={(event) => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted) }}
        onWaiting={(event) => { if (!event.currentTarget.paused) setStatus('loading') }}
        onError={() => {
          if (hlsRef.current || !activeSource) return
          reportPlaybackError(activeSource, '视频加载失败，请确认地址有效且源站允许浏览器直接访问')
        }}
      />
      {showTitleOverlay && activeSource && title && <div className="video-player-title-overlay" title={title}>{title}</div>}
      {!presentationReceiver && !presentation && activeSource && status === 'paused' && !videoRef.current?.ended && <div className="video-player-paused-indicator" aria-label="已暂停"><PlayCircleOutlined /></div>}
      {!activeSource && <div className="video-player-placeholder" aria-hidden="true"><PlayCircleOutlined /></div>}
      {presentation && <div className="video-player-presented-message" role="status" aria-live="polite">
        <DesktopOutlined />
        <strong>视频已投屏</strong>
        <span>当前设备已暂停播放</span>
      </div>}
      {status === 'loading' && !presentation && <div className="video-player-loading" aria-live="polite"><span /></div>}
      {gestureFeedback && <div className="video-player-gesture-feedback" role="status" aria-live="polite">
        <strong>{gestureFeedback.label}</strong>
        {gestureFeedback.value !== undefined && <><span>{gestureFeedback.value}%</span><i aria-hidden="true"><b style={{ width: `${gestureFeedback.value}%` }} /></i></>}
      </div>}
      {isFullscreen && supportsScreenLock && <Button className="video-player-screen-lock" type="text" shape="circle" icon={screenLocked ? <UnlockOutlined /> : <LockOutlined />} aria-label={screenLocked ? '解除锁屏' : '锁定屏幕'} onClick={() => void toggleScreenLock()} />}
      {!presentationReceiver && <div className="video-player-overlay-actions" aria-label="播放器操作" onMouseEnter={keepControlsVisible} onMouseMove={(event) => event.stopPropagation()} onMouseLeave={scheduleControlsHide}>
        {topRightContent}
        <Popover rootClassName="video-player-share-popover" placement="bottomRight" trigger="click" open={shareOpen} onOpenChange={setShareOpen} getPopupContainer={() => stageRef.current || document.body} content={<div className="video-player-share-options">
          {typeof navigator.share === 'function' && <Button type="text" onClick={() => void shareVideo()}>分享到应用</Button>}
          <Button type="text" onClick={() => void copyVideoLink()}>复制链接</Button>
        </div>}>
          <Button type="text" shape="circle" icon={<ShareAltOutlined />} disabled={!activeSource} aria-label="分享" />
        </Popover>
        <Button type="text" shape="circle" icon={casting ? <DisconnectOutlined /> : <DesktopOutlined />} disabled={!activeSource} aria-label={presentation ? '退出投屏' : airPlayConnected ? '切换或退出隔空播放' : '投屏'} onClick={() => (presentation ? stopPresentation() : void presentVideo())} />
      </div>}
      {!presentationReceiver && sideContent}
      {!presentationReceiver && !presentation && <div className="video-player-bottom-controls" aria-label="播放控制" onMouseEnter={keepControlsVisible} onMouseMove={(event) => event.stopPropagation()} onMouseLeave={scheduleControlsHide}>
        {onPreviousEpisode && <Button type="text" shape="circle" icon={<StepBackwardOutlined />} aria-label="上一集" disabled={!activeSource || !canPreviousEpisode} onClick={onPreviousEpisode} />}
        <Button type="text" shape="circle" icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} aria-label={isPlaying ? '暂停' : '播放'} disabled={!activeSource} onClick={() => void togglePlayback()} />
        {onNextEpisode && <Button type="text" shape="circle" icon={<StepForwardOutlined />} aria-label="下一集" disabled={!activeSource || !canNextEpisode} onClick={onNextEpisode} />}
        <span className="video-player-time">{formatPlaybackTime(currentTime)}</span>
        <div className="video-player-progress-shell">
          <div className="video-player-progress-track" aria-hidden="true">
            {duration > 0 && bufferedRanges.map((range, index) => <span key={`${range.start}-${range.end}-${index}`} className="video-player-progress-buffered" style={{ left: `${Math.max(0, range.start / duration * 100)}%`, width: `${Math.max(0, (range.end - range.start) / duration * 100)}%` }} />)}
            <span className="video-player-progress-played" style={{ width: `${playedPercent}%` } as CSSProperties} />
          </div>
          <input className="video-player-progress" type="range" min={0} max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} aria-label="播放进度" onChange={(event) => {
            const player = videoRef.current
            if (!player || !Number.isFinite(player.duration)) return
            player.currentTime = Number(event.target.value)
            lastPlaybackPositionRef.current = player.currentTime
            setCurrentTime(player.currentTime)
          }} />
        </div>
        <span className="video-player-time">{formatPlaybackTime(duration)}</span>
        <Popover rootClassName="video-player-volume-popover" placement="top" trigger="click" open={volumeOpen} getPopupContainer={() => stageRef.current || document.body} onOpenChange={(open) => { setVolumeOpen(open); if (open) keepControlsVisible(); else scheduleControlsHide() }} content={<div className="video-player-volume-slider" onPointerDown={(event) => event.stopPropagation()} onMouseMove={(event) => event.stopPropagation()}><Slider vertical min={0} max={100} step={1} value={muted ? 0 : Math.round(volume * 100)} disabled={!activeSource} aria-label="音量" tooltip={{ formatter: (value) => `${value ?? 0}%`, getPopupContainer: (trigger) => trigger.parentElement || stageRef.current || document.body }} onChange={changeVolume} /></div>}>
          <Button className="video-player-volume-trigger" type="text" shape="circle" icon={muted || volume === 0 ? <MutedFilled /> : <SoundFilled />} disabled={!activeSource} aria-label="调节音量" />
        </Popover>
        <select className="video-player-rate" name="playback-rate" value={playbackRate} disabled={!activeSource} aria-label="播放速度" onChange={(event) => {
          const value = Number(event.target.value)
          if (videoRef.current) videoRef.current.playbackRate = value
          setPlaybackRate(value)
        }}>
          <option value={0.5}>0.5x</option><option value={0.75}>0.75x</option><option value={1}>1x</option>
          <option value={1.25}>1.25x</option><option value={1.5}>1.5x</option><option value={2}>2x</option>
        </select>
        <Button type="text" shape="circle" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} aria-label={isFullscreen ? '退出全屏' : '全屏'} disabled={!activeSource} onClick={() => void toggleFullscreen()} />
      </div>}
    </section>
    {error && <div className="video-player-error" role="alert">{error}</div>}
  </>
}
