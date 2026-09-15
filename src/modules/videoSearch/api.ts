import { apiRequest } from '../../api'
import type { VideoSearchResponse } from './types'

export const videoSearchApi = {
  search: (keyword: string) => apiRequest<VideoSearchResponse>('/api/video-search/search', {
    method: 'POST',
    body: JSON.stringify({ keyword }),
  }),
  resolve: (resolveToken: string) => apiRequest<{ url: string }>('/api/video-search/resolve', {
    method: 'POST',
    body: JSON.stringify({ resolveToken }),
  }),
}
