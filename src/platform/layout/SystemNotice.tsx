import { useEffect, useRef, useState } from 'react'
import { sanitizeHtml } from '../../shared/sanitize-html'

export default function SystemNotice({ content }: { content: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(20)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(() => setDuration(Math.max(16, Math.round(track.scrollWidth / 65))))
    observer.observe(track)
    return () => observer.disconnect()
  }, [content])

  return <div className="workbench-notice" role="region" aria-label="系统通知">
    <div className="workbench-notice-track" ref={trackRef} style={{ animationDuration: `${duration}s` }}>
      <div className="workbench-notice-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
    </div>
  </div>
}
