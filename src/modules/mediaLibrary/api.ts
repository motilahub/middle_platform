import { apiRequest } from '../../api'
import type { MediaCatalogFilters, MediaCatalogResponse, MediaCatalogType, MediaItem, MediaItemInput, MediaSyncResponse, MediaType, PanSearchResponse, PlayableSearchResponse, ResourceSearchResponse, ResourceSearchResult } from './types'

export const mediaLibraryApi = {
  list: (type: MediaType, q = '') => apiRequest<MediaItem[]>(`/api/media-library/items?${new URLSearchParams({ type, q })}`),
  catalog: (params: { type: MediaCatalogType; q?: string; genres?: string[]; countries?: string[]; year?: number; sort?: 'default' | 'newest'; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams({ type: params.type })
    if (params.q) query.set('q', params.q)
    if (params.genres?.length) query.set('genres', params.genres.join(','))
    if (params.countries?.length) query.set('countries', params.countries.join(','))
    if (params.year) query.set('year', String(params.year))
    if (params.sort === 'newest') query.set('sort', 'newest')
    if (params.page && params.page > 1) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    return apiRequest<MediaCatalogResponse>(`/api/media-library/catalog?${query}`)
  },
  catalogFilters: () => apiRequest<MediaCatalogFilters>('/api/media-library/catalog/filters'),
  get: (id: string) => apiRequest<MediaItem>(`/api/media-library/items/${encodeURIComponent(id)}`),
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
