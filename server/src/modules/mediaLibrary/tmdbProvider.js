import nodeFetch from 'node-fetch'
import { ProxyAgent } from 'proxy-agent'

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function yearFrom(value) {
  const year = String(value || '').match(/^(?:19|20)\d{2}/)?.[0]
  return year ? Number(year) : null
}

function posterFrom(path) {
  return typeof path === 'string' && /^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)
    ? `https://image.tmdb.org/t/p/w500${path}` : null
}

function detailsFrom(body, mediaType) {
  const genres = (Array.isArray(body.genres) ? body.genres : []).map((genre) => String(genre?.name || '').trim()).filter(Boolean)
  const date = mediaType === 'tv' ? body.first_air_date : body.release_date
  return {
    contentCategory: (body.genres || []).some((genre) => genre?.id === 16) ? 'anime' : 'general',
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : null,
    runtimeMinutes: mediaType === 'tv' ? Number(body.episode_run_time?.[0]) || null : Number(body.runtime) || null,
    genres, countries: (body.production_countries || []).map((entry) => entry.name).filter(Boolean),
    languages: (body.spoken_languages || []).map((entry) => entry.name).filter(Boolean),
    directors: mediaType === 'tv'
      ? (body.created_by || []).map((person) => person.name).filter(Boolean)
      : (body.credits?.crew || []).filter((person) => person.job === 'Director').map((person) => person.name).filter(Boolean),
    castMembers: (body.credits?.cast || []).slice(0, 20).map((person) => person.name).filter(Boolean),
  }
}

export function normalizeTmdbSearch(body) {
  return (Array.isArray(body?.results) ? body.results : []).flatMap((entry) => {
    const mediaType = entry?.media_type
    const externalId = String(entry?.id || '')
    const title = String(mediaType === 'tv' ? entry?.name || '' : entry?.title || '').trim()
    if (!['movie', 'tv'].includes(mediaType) || !/^[1-9]\d*$/.test(externalId) || !title) return []
    const rating = Number(entry.vote_average)
    return [{
      source: 'tmdb', externalId, mediaType, title: title.slice(0, 300),
      contentCategory: (entry.genre_ids || []).includes(16) ? 'anime' : 'general',
      year: yearFrom(mediaType === 'tv' ? entry.first_air_date : entry.release_date),
      posterUrl: posterFrom(entry.poster_path),
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      subtitle: String(entry.overview || '').trim().slice(0, 1000),
      sourceUrl: `https://www.themoviedb.org/${mediaType}/${externalId}`,
    }]
  })
}

export function normalizeTmdbDetail(body, mediaType) {
  const externalId = String(body?.id || '')
  const title = String(mediaType === 'tv' ? body?.name || '' : body?.title || '').trim()
  if (!/^[1-9]\d*$/.test(externalId) || !title) throw providerError('TMDB 条目数据不完整')
  const rating = Number(body.vote_average)
  const episodes = Number(body.number_of_episodes)
  const totalEpisodeCount = mediaType === 'tv' && Number.isInteger(episodes) && episodes > 0 && episodes <= 9999 ? episodes : null
  return {
    source: 'tmdb', externalId, mediaType, title: title.slice(0, 300),
    originalTitle: String(mediaType === 'tv' ? body.original_name || '' : body.original_title || '').trim().slice(0, 300) || null,
    year: yearFrom(mediaType === 'tv' ? body.first_air_date : body.release_date),
    posterUrl: posterFrom(body.poster_path),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    ranking: null,
    summary: String(body.overview || '').trim().slice(0, 5000) || null,
    episodeCount: totalEpisodeCount,
    totalEpisodeCount,
    availableEpisodeCount: null,
    episodeStatus: 'unknown',
    sourceUrl: `https://www.themoviedb.org/${mediaType}/${externalId}`,
    metadata: { ratingCount: Number(body.vote_count) || 0 },
    ...detailsFrom(body, mediaType),
  }
}

export function createTmdbProvider(options = {}) {
  const accessToken = String(options.accessToken ?? process.env.TMDB_ACCESS_TOKEN ?? '').trim()
  const apiKey = String(options.apiKey ?? process.env.TMDB_API_KEY ?? '').trim()
  const configured = Boolean(accessToken || apiKey)
  const proxyUrl = String(options.proxyUrl ?? process.env.TMDB_PROXY_URL ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? '').trim()
  let proxyAgent
  if (proxyUrl) {
    try {
      proxyAgent = new ProxyAgent(proxyUrl)
    } catch (error) {
      throw providerError(`TMDB 代理配置无效: ${error.message}`, 500)
    }
  }
  // Tests and embedding applications can inject fetch. Production uses node-fetch
  // only when a proxy is configured, because the native fetch API has no SOCKS agent.
  const request = options.fetch || (proxyAgent
    ? (url, init) => nodeFetch(url, { ...init, agent: proxyAgent })
    : fetch)
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs ?? process.env.TMDB_TIMEOUT_MS) || 12000))

  async function fetchJson(path, params = {}) {
    if (!configured) throw providerError('未配置 TMDB_ACCESS_TOKEN 或 TMDB_API_KEY', 503)
    const url = new URL(path, 'https://api.themoviedb.org')
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    if (!accessToken) url.searchParams.set('api_key', apiKey)
    let response
    try {
      response = await request(url, {
        headers: { accept: 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError('TMDB 请求超时', 504)
      throw providerError('暂时无法连接 TMDB')
    }
    if (!response.ok) throw providerError(response.status === 401 ? 'TMDB 凭据无效' : `TMDB 返回 ${response.status}`)
    try { return await response.json() } catch { throw providerError('TMDB 未返回有效数据') }
  }

  return {
    id: 'tmdb', name: 'TMDB', configured,
    async search(keyword) {
      const value = String(keyword || '').trim().slice(0, 100)
      if (!value) throw providerError('请输入影视名称', 400)
      const body = await fetchJson('/3/search/multi', { query: value, language: 'zh-CN', include_adult: false, page: 1 })
      return normalizeTmdbSearch(body).slice(0, 20)
    },
    async get(mediaType, externalId) {
      if (!['movie', 'tv'].includes(mediaType) || !/^[1-9]\d*$/.test(String(externalId))) throw providerError('TMDB 条目无效', 400)
      const body = await fetchJson(`/3/${mediaType}/${externalId}`, { language: 'zh-CN', append_to_response: 'credits' })
      return normalizeTmdbDetail(body, mediaType)
    },
  }
}
