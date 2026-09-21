const COLLECTION_PATTERN = /^[a-z0-9_]{3,80}$/

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function normalizeCollection(value, fallback) {
  const collection = String(value || fallback).trim()
  if (!COLLECTION_PATTERN.test(collection)) throw new Error('豆瓣榜单编码无效')
  return collection
}

function normalizeBaseUrl(value) {
  const url = new URL(value || 'https://m.douban.com')
  if (url.protocol !== 'https:') throw new Error('DOUBAN_BASE_URL 必须使用 HTTPS')
  return url.origin
}

function yearFrom(item) {
  const candidate = String(item?.year || item?.card_subtitle || '').match(/(?:19|20)\d{2}/)?.[0]
  return candidate ? Number(candidate) : null
}

export function episodeCountFrom(value) {
  const matched = String(value || '').match(/(\d{1,4})\s*集/)
  return matched ? Number(matched[1]) : null
}

export function episodeProgressFrom(value, declaredTotal) {
  const info = String(value || '').trim()
  const total = Number(declaredTotal) > 0 ? Number(declaredTotal) : null
  const completed = info.match(/(?:全\s*(\d{1,4})\s*集|(\d{1,4})\s*集\s*全)/)
  if (completed) {
    const count = Number(completed[1] || completed[2])
    return { totalEpisodeCount: total || count, availableEpisodeCount: count, episodeStatus: 'completed' }
  }
  const updating = info.match(/(?:更新至|更新到|已更新)\s*(?:第\s*)?(\d{1,4})\s*集/)
  if (updating) return { totalEpisodeCount: total, availableEpisodeCount: Number(updating[1]), episodeStatus: 'updating' }
  const statedCount = episodeCountFrom(info)
  return { totalEpisodeCount: total || statedCount, availableEpisodeCount: null, episodeStatus: 'unknown' }
}

export function normalizeDoubanItems(body, mediaType, collection, rankOffset = 0) {
  const items = Array.isArray(body?.subject_collection_items) ? body.subject_collection_items : []
  return items.flatMap((item, index) => {
    const externalId = String(item?.id || '').trim()
    const title = String(item?.title || '').trim()
    if (!/^\d+$/.test(externalId) || !title) return []
    const rating = Number(item?.rating?.value)
    const rank = Number(item?.rank) || rankOffset + index + 1
    const episodesInfo = String(item?.episodes_info || '').trim()
    const progress = mediaType === 'tv' ? episodeProgressFrom(episodesInfo, item?.episodes_count) : {}
    return [{
      source: 'douban',
      externalId,
      mediaType,
      title: title.slice(0, 300),
      originalTitle: null,
      year: yearFrom(item),
      posterUrl: String(item?.cover_url || item?.pic?.large || item?.pic?.normal || '').trim() || null,
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      ranking: rank,
      summary: String(item?.description || item?.comment || '').trim().slice(0, 5000) || null,
      episodeCount: mediaType === 'tv' ? progress.availableEpisodeCount || progress.totalEpisodeCount : null,
      totalEpisodeCount: progress.totalEpisodeCount || null,
      availableEpisodeCount: progress.availableEpisodeCount || null,
      episodeStatus: progress.episodeStatus || 'unknown',
      sourceUrl: `https://movie.douban.com/subject/${externalId}/`,
      metadata: {
        collection,
        subtitle: String(item?.card_subtitle || '').trim(),
        episodesInfo,
        ratingCount: Number(item?.rating?.count) || 0,
      },
    }]
  })
}

export function normalizeDoubanSearch(body) {
  const items = Array.isArray(body) ? body : Array.isArray(body?.subjects?.items) ? body.subjects.items : []
  return items.flatMap((entry) => {
    const target = entry?.target || entry || {}
    const mediaType = entry?.target_type === 'tv' || target?.type === 'tv'
      ? 'tv'
      : entry?.target_type === 'movie' || target?.type === 'movie'
        ? (String(target?.episode || '').match(/^\d+$/) ? 'tv' : 'movie')
        : null
    const externalId = String(target?.id || entry?.target_id || '').trim()
    const title = String(target?.title || '').trim()
    if (!mediaType || !/^\d+$/.test(externalId) || !title) return []
    const rating = Number(target?.rating?.value)
    return [{
      externalId,
      mediaType,
      contentCategory: (Array.isArray(target?.genres) ? target.genres : []).some((genre) => /动画|动漫|anime|animation/i.test(String(genre))) ? 'anime' : 'general',
      title: title.slice(0, 300),
      year: yearFrom(target),
      posterUrl: String(target?.cover_url || target?.img || '').trim() || null,
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      subtitle: String(target?.card_subtitle || target?.sub_title || '').trim().slice(0, 1000),
      sourceUrl: `https://movie.douban.com/subject/${externalId}/`,
    }]
  })
}

export function normalizeDoubanWebSearch(body) {
  const items = Array.isArray(body?.items) ? body.items : []
  return items.flatMap((entry) => {
    const externalId = String(entry?.id || '').trim()
    const rawTitle = String(entry?.title || '').replace(/[\u200e\u200f]/g, '').trim()
    const titleWithOriginal = rawTitle.replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim()
    const title = titleWithOriginal.match(/^(.+[\u3400-\u9fff])\s+(?=[^\u3400-\u9fff\s])/)?.[1] || titleWithOriginal
    if (!/^\d+$/.test(externalId) || !title || entry?.tpl_name !== 'search_subject') return []
    const labels = Array.isArray(entry.labels) ? entry.labels.map((label) => String(label?.text || '')) : []
    const rating = Number(entry?.rating?.value)
    return [{
      externalId,
      mediaType: labels.includes('剧集') ? 'tv' : 'movie',
      contentCategory: /动画|动漫|anime|animation/i.test(String(entry.abstract || '')) ? 'anime' : 'general',
      title: title.slice(0, 300),
      year: yearFrom({ year: rawTitle }),
      posterUrl: String(entry?.cover_url || '').trim() || null,
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      subtitle: String(entry?.abstract || '').trim().slice(0, 1000),
      sourceUrl: `https://movie.douban.com/subject/${externalId}/`,
    }]
  })
}

export function parseDoubanSearchPage(html) {
  const content = String(html || '')
  if (content.length > 1024 * 1024) throw providerError('豆瓣搜索返回内容过大')
  const startMarker = 'window.__DATA__ = '
  const endMarker = 'window.__USER__'
  const start = content.indexOf(startMarker)
  const end = content.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0) throw providerError('豆瓣搜索未返回有效数据')
  const json = content.slice(start + startMarker.length, end).trim().replace(/;\s*$/, '')
  try { return JSON.parse(json) } catch { throw providerError('豆瓣搜索未返回有效数据') }
}

export function normalizeDoubanDetail(body, mediaType) {
  const externalId = String(body?.id || '').trim()
  const title = String(body?.title || '').trim()
  if (!/^\d+$/.test(externalId) || !title || !['movie', 'tv'].includes(mediaType)) throw providerError('豆瓣条目数据无效')
  const rating = Number(body?.rating?.value)
  const progress = mediaType === 'tv' ? episodeProgressFrom(body?.episodes_info, body?.episodes_count) : {}
  const names = (list) => (Array.isArray(list) ? list : []).map((entry) => String(typeof entry === 'string' ? entry : entry?.name || '').trim()).filter(Boolean)
  const genres = names(body?.genres)
  const date = String(body?.pubdate?.[0] || body?.release_date || '').trim()
  const duration = String(body?.durations?.[0] || body?.duration || '').match(/\d+/)?.[0]
  return {
    source: 'douban',
    externalId,
    mediaType,
    title: title.slice(0, 300),
    originalTitle: String(body?.original_title || '').trim().slice(0, 300) || null,
    year: yearFrom(body),
    posterUrl: String(body?.cover_url || body?.cover?.image?.normal?.url || '').trim() || null,
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    ranking: null,
    summary: String(body?.intro || '').trim().slice(0, 5000) || null,
    episodeCount: mediaType === 'tv' ? progress.availableEpisodeCount || progress.totalEpisodeCount : null,
    totalEpisodeCount: progress.totalEpisodeCount || null,
    availableEpisodeCount: progress.availableEpisodeCount || null,
    episodeStatus: progress.episodeStatus || 'unknown',
    sourceUrl: `https://movie.douban.com/subject/${externalId}/`,
    contentCategory: genres.some((genre) => /动画|动漫|anime|animation/i.test(genre)) ? 'anime' : 'general',
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    runtimeMinutes: Number(duration) > 0 ? Number(duration) : null,
    genres,
    countries: names(body?.countries),
    languages: names(body?.languages),
    directors: names(body?.directors),
    castMembers: names(body?.actors).slice(0, 20),
    metadata: {
      subtitle: String(body?.card_subtitle || '').trim(),
      episodesInfo: String(body?.episodes_info || '').trim(),
      ratingCount: Number(body?.rating?.count) || 0,
    },
  }
}

export function createDoubanProvider(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.DOUBAN_BASE_URL)
  const movieCollection = normalizeCollection(options.movieCollection || process.env.DOUBAN_MOVIE_COLLECTION, 'movie_top250')
  const tvCollection = normalizeCollection(options.tvCollection || process.env.DOUBAN_TV_COLLECTION, 'tv_hot')
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env.DOUBAN_TIMEOUT_MS) || 12000))
  const request = options.fetch || fetch

  async function fetchJson(path, searchParams, label, referer = `${baseUrl}/`) {
    const url = new URL(path, baseUrl)
    Object.entries(searchParams || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    let response
    try {
      response = await request(url, {
        headers: {
          accept: 'application/json',
          referer,
          'user-agent': 'Mozilla/5.0 (compatible; MotilaMediaLibrary/1.0)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError(`${label}请求超时`, 504)
      throw providerError(`暂时无法连接${label}`)
    }
    if (!response.ok) throw providerError(`${label}返回 ${response.status}`)
    try { return await response.json() } catch { throw providerError(`${label}未返回有效数据`) }
  }

  async function fetchSearchPage(keyword, start) {
    const url = new URL('/movie/subject_search', 'https://search.douban.com')
    url.searchParams.set('search_text', keyword)
    url.searchParams.set('cat', '1002')
    url.searchParams.set('start', String(start))
    let response
    try {
      response = await request(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          referer: 'https://movie.douban.com/',
          'user-agent': 'Mozilla/5.0 (compatible; MotilaMediaLibrary/1.0)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError('豆瓣搜索请求超时', 504)
      throw providerError('暂时无法连接豆瓣搜索')
    }
    if (!response.ok) throw providerError(`豆瓣搜索返回 ${response.status}`)
    return normalizeDoubanWebSearch(parseDoubanSearchPage(await response.text()))
  }

  async function list(mediaType, limit = 250) {
    if (!['movie', 'tv'].includes(mediaType)) throw providerError('不支持的影视类型', 400)
    const collection = mediaType === 'movie' ? movieCollection : tvCollection
    const safeLimit = Math.min(250, Math.max(1, Number(limit) || 250))
    const items = []
    const externalIds = new Set()
    let start = 0
    while (items.length < safeLimit && start < safeLimit) {
      const count = Math.min(50, safeLimit - start)
      const body = await fetchJson(
        `/rexxar/api/v2/subject_collection/${collection}/items`,
        { start, count },
        `豆瓣${mediaType === 'movie' ? '电影' : '电视剧'}榜单`,
      )
      const rawPageSize = Array.isArray(body?.subject_collection_items) ? body.subject_collection_items.length : 0
      const collectionTotal = Number(body?.total || body?.subject_collection?.total)
      const page = normalizeDoubanItems(body, mediaType, collection, start)
      for (const item of page) {
        if (externalIds.has(item.externalId)) continue
        externalIds.add(item.externalId)
        items.push(item)
      }
      start += count
      const hasCollectionTotal = Number.isFinite(collectionTotal) && collectionTotal > 0
      if (!rawPageSize || (hasCollectionTotal ? start >= collectionTotal : rawPageSize < count)) break
    }
    if (!items.length) throw providerError(`豆瓣${mediaType === 'movie' ? '电影' : '电视剧'}榜单暂无可用数据`)
    return items.slice(0, safeLimit)
  }

  async function search(value, limit = 30) {
    const keyword = String(value || '').trim().slice(0, 100)
    if (!keyword) throw providerError('请输入影视名称', 400)
    const safeLimit = Math.min(30, Math.max(1, Number(limit) || 30))
    let candidates = []
    let searchError
    try {
      const pages = await Promise.allSettled([0, 15].slice(0, Math.ceil(safeLimit / 15)).map((start) => fetchSearchPage(keyword, start)))
      candidates = pages.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : [])
      const seen = new Set()
      candidates = candidates.filter((candidate) => {
        if (seen.has(candidate.externalId)) return false
        seen.add(candidate.externalId)
        return true
      })
      if (!candidates.length) searchError = pages.find((entry) => entry.status === 'rejected')?.reason
    } catch (error) { searchError = error }
    if (!candidates.length) {
      try {
        const body = await fetchJson('/rexxar/api/v2/search', { q: keyword }, '豆瓣搜索')
        if (body?.code) throw providerError(`豆瓣搜索暂不可用（${body.code}）`)
        candidates = normalizeDoubanSearch(body)
      } catch (error) { if (!searchError) searchError = error }
    }
    if (!candidates.length) {
      try {
        const body = await fetchJson('https://movie.douban.com/j/subject_suggest', { q: keyword }, '豆瓣搜索', 'https://movie.douban.com/')
        candidates = normalizeDoubanSearch(body)
      } catch (error) { if (!searchError) searchError = error }
    }
    if (!candidates.length && searchError) throw searchError
    return candidates.slice(0, safeLimit)
  }

  async function get(mediaType, externalId) {
    if (!['movie', 'tv'].includes(mediaType)) throw providerError('不支持的影视类型', 400)
    const safeId = String(externalId || '').trim()
    if (!/^\d+$/.test(safeId)) throw providerError('豆瓣 ID 无效', 400)
    const body = await fetchJson(`/rexxar/api/v2/${mediaType}/${safeId}`, {}, '豆瓣条目')
    if (String(body?.type || mediaType) !== mediaType) throw providerError('豆瓣影视类型不匹配', 400)
    return normalizeDoubanDetail(body, mediaType)
  }

  return { id: 'douban', name: '豆瓣', list, search, get }
}
