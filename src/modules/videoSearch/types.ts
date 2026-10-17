export type VideoStorageType = 'baidu' | 'aliyun' | 'quark' | 'guangya' | 'tianyi' | 'uc' | 'mobile' | '115' | 'pikpak' | 'xunlei' | '123' | 'magnet' | 'ed2k'
export type VideoSearchSourceState = 'success' | 'partial' | 'failed'

export interface VideoSearchResult {
  id: string
  title: string
  provider: string
  providerName: string
  storageType: VideoStorageType
  sourceLine?: string
  linkMode: 'direct' | 'resolve'
  url?: string
  resolveToken?: string
}

export interface VideoSearchSourceStatus {
  id: string
  name: string
  status: VideoSearchSourceState
  count: number
  message?: string
}

export interface VideoSearchResponse {
  keyword: string
  results: VideoSearchResult[]
  sources: VideoSearchSourceStatus[]
}
