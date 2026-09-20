import type { MediaItem } from './types'

export function episodeLimit(item: MediaItem) {
  return item.totalEpisodeCount || item.availableEpisodeCount || item.episodeCount || null
}

export function episodeLabel(item: MediaItem) {
  const total = item.totalEpisodeCount
  const available = item.availableEpisodeCount
  return `${total || available} 集`
  
}
