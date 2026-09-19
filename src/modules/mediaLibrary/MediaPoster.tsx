import { useEffect, useState } from 'react'
import type { MediaItem } from './types'

export default function MediaPoster({ item, alt = '', loading = 'lazy' }: {
  item: MediaItem
  alt?: string
  loading?: 'eager' | 'lazy'
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [item.id])

  if (!item.posterUrl || failed) return <span aria-hidden="true">{item.title.slice(0, 1)}</span>
  return <img
    src={`/api/media-library/items/${item.id}/poster`}
    alt={alt}
    loading={loading}
    onError={() => setFailed(true)}
  />
}
