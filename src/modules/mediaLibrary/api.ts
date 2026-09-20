import { apiRequest } from '../../api'
import type { MediaItem, MediaItemInput, MediaSyncResponse, MediaType, PanSearchResponse, PlayableSearchResponse, ResourceSearchResponse, ResourceSearchResult } from './types'

export const mediaLibraryApi = {
  list: (type: MediaType, q = '') => apiRequest<MediaItem[]>(`/api/media-library/items?${new URLSearchParams({ type, q })}`),
  get: (id: number) => apiRequest<MediaItem>(`/api/media-library/items/${id}`),
  sync: () => apiRequest<MediaSyncResponse>('/api/media-library/sync', { method: 'POST' }),
  adminList: (type: MediaType | 'all' | 'anime' = 'all', q = '') => apiRequest<MediaItem[]>(`/api/media-library/admin/items?${new URLSearchParams({ type, q })}`),
  create: (item: MediaItemInput) => apiRequest<MediaItem>('/api/media-library/admin/items', { method: 'POST', body: JSON.stringify(item) }),
  update: (id: number, item: MediaItemInput) => apiRequest<MediaItem>(`/api/media-library/admin/items/${id}`, { method: 'PUT', body: JSON.stringify(item) }),
  delete: (id: number) => apiRequest<{ deleted: number }>(`/api/media-library/admin/items/${id}`, { method: 'DELETE' }),
  deleteMany: (ids: number[]) => apiRequest<{ deleted: number }>('/api/media-library/admin/items', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  searchResources: (keyword: string) => apiRequest<ResourceSearchResponse>('/api/media-library/admin/resource-search', {
    method: 'POST',
    body: JSON.stringify({ keyword }),
  }),
  importResource: ({ source, externalId, mediaType }: ResourceSearchResult) => apiRequest<{ item: MediaItem; inserted: boolean; message: string }>('/api/media-library/admin/import', {
    method: 'POST',
    body: JSON.stringify({ source, externalId, mediaType }),
  }),
  searchPan: (keyword: string) => apiRequest<PanSearchResponse>('/api/video-search/search', {
    method: 'POST',
    body: JSON.stringify({ keyword }),
  }),
  resolvePan: (resolveToken: string) => apiRequest<{ url: string }>('/api/video-search/resolve', {
    method: 'POST',
    body: JSON.stringify({ resolveToken }),
  }),
  searchPlayable: (mediaId: number, episode?: number) => apiRequest<PlayableSearchResponse>('/api/media-library/playable-search', {
    method: 'POST',
    body: JSON.stringify({ mediaId, episode }),
  }),
}
