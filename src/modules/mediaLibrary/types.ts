export type MediaType = 'movie' | 'tv'
export type MediaCatalogType = 'all' | MediaType | 'anime'

export interface MediaItem {
  id: number
  publicId: string
  source: string
  externalId: string
  mediaType: MediaType
  contentCategory: 'general' | 'anime'
  title: string
  originalTitle?: string | null
  year?: number | null
  posterUrl?: string | null
  rating?: number | null
  ranking?: number | null
  summary?: string | null
  releaseDate?: string | null
  runtimeMinutes?: number | null
  genres: string[]
  countries: string[]
  languages: string[]
  directors: string[]
  castMembers: string[]
  episodeCount?: number | null
  totalEpisodeCount?: number | null
  availableEpisodeCount?: number | null
  episodeStatus: 'updating' | 'completed' | 'unknown'
  sourceUrl?: string | null
  metadata: {
    collection?: string
    subtitle?: string
    episodesInfo?: string
    ratingCount?: number
  }
  isRanked: boolean
  addedManually: boolean
  detailSyncedAt?: string | null
  rankingSyncedAt?: string | null
  createdAt?: string | null
}

export interface MediaCatalogResponse {
  items: MediaItem[]
  total: number
  page: number
  pageSize: number
  type: MediaCatalogType
  keyword: string
  sort: 'default' | 'newest'
}

export interface MediaCatalogFilters {
  genres: string[]
  countries: string[]
  years: number[]
}

export interface MediaItemInput {
  mediaType: MediaType
  title: string
  originalTitle?: string | null
  year?: number | null
  posterUrl?: string | null
  rating?: number | null
  summary?: string | null
  contentCategory?: 'general' | 'anime'
  releaseDate?: string | null
  runtimeMinutes?: number | null
  genres?: string[]
  countries?: string[]
  languages?: string[]
  directors?: string[]
  castMembers?: string[]
  totalEpisodeCount?: number | null
  availableEpisodeCount?: number | null
  sourceUrl?: string | null
}

export interface ResourceSearchResult {
  source: 'douban' | 'tmdb'
  contentCategory?: 'general' | 'anime'
  externalId: string
  mediaType: MediaType
  title: string
  year?: number | null
  posterUrl?: string | null
  rating?: number | null
  subtitle?: string
  sourceUrl: string
  inLibrary: boolean
}

export interface ResourceSearchResponse {
  results: ResourceSearchResult[]
  providers: Array<{ source: 'douban' | 'tmdb'; name: string; status: 'success' | 'failed' | 'unconfigured'; message?: string }>
}

export interface MediaSyncResponse {
  sources: Array<{
    type: MediaType
    status: 'success' | 'failed'
    count: number
    inserted: number
    updated: number
    message?: string
  }>
  episodeProgress?: {
    count: number
    updated: number
    failed: number
    syncedAt: string
  }
  syncedAt: string
}

export interface PanResource {
  id: string
  title: string
  providerName: string
  storageType: 'baidu' | 'quark' | 'uc' | 'xunlei'
  sourceLine?: string
  url?: string
  resolveToken?: string
}

export interface PanSearchResponse {
  keyword: string
  results: PanResource[]
}

export interface PlayableResource {
  id: string
  provider: string
  providerName: string
  title: string
  type: 'hls' | 'direct'
  url: string
}

export interface PlayableSearchResponse {
  keyword: string
  results: PlayableResource[]
  providers: Array<{ id: string; name: string; status: 'success' | 'failed'; count?: number; message?: string }>
  message?: string
}
