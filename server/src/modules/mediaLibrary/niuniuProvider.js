const DEFAULT_SITE_URL = 'https://niuniuzy4.com'
const DEFAULT_API_URL = 'https://api.niuniuzy.me/api.php/provide/vod/from/nnm3u8/at/json'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function normalizeUrl(value, fallback, label, endpoint = false) {
  const url = new URL(String(value || fallback).trim())
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label}必须是无认证信息的 HTTPS 地址`)
  if (!endpoint) return url.origin
  url.hash = ''
  url.search = ''
  return url.toString()
}

function normalizedTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function entryEpisode(label) {
  const text = String(label || '').normalize('NFKC').trim()
  const matched = text.match(/第\s*0*(\d{1,4})\s*集/i)
    || text.match(/(?:^|\b)(?:EP?|集)\s*0*(\d{1,4})(?:\b|$)/i)
    || text.match(/^0*(\d{1,4})$/)
  return matched ? positiveInteger(matched[1]) : null
}

function parseEntries(value) {
  return String(value || '').split('#').flatMap((entry, index) => {
    const separator = entry.indexOf('$')
    if (separator <= 0) return []
    const label = entry.slice(0, separator).trim()
    const url = entry.slice(separator + 1).trim()
    if (!label || !url) return []
    return [{ label, url, episode: entryEpisode(label), index }]
  })
}

export function normalizeNiuniuResults(records, input) {
  const targetTitle = normalizedTitle(input.title)
  const requestedYear = positiveInteger(input.year)
  const requestedEpisode = positiveInteger(input.episode)
  const results = []

  for (const record of Array.isArray(records) ? records : []) {
    const title = String(record?.vod_name || '').trim()
    if (!title || normalizedTitle(title) !== targetTitle) continue
    const year = positiveInteger(record?.vod_year)
    if (requestedYear && year && requestedYear !== year) continue

    const sources = String(record?.vod_play_from || '').split('$$$')
    const groups = String(record?.vod_play_url || '').split('$$$')
    sources.forEach((source, sourceIndex) => {
      if (source.trim().toLowerCase() !== 'nnm3u8') return
      const entries = parseEntries(groups[sourceIndex])
      const selected = requestedEpisode
        ? entries.filter((entry) => entry.episode === requestedEpisode)
        : entries.slice(0, 6)
      const fallback = requestedEpisode && !selected.length && entries.every((entry) => entry.episode === null)
        ? entries[requestedEpisode - 1] : null
      for (const entry of selected.length ? selected : fallback ? [fallback] : []) {
        results.push({
          title: `${title} · ${entry.label}`,
          url: entry.url,
          type: 'hls',
        })
      }
    })
  }
  return results
}

export function createNiuniuProvider(options = {}) {
  const siteUrl = normalizeUrl(options.siteUrl || process.env.NIUNIU_SITE_URL, DEFAULT_SITE_URL, 'NIUNIU_SITE_URL')
  const apiUrl = normalizeUrl(options.apiUrl || process.env.NIUNIU_API_URL, DEFAULT_API_URL, 'NIUNIU_API_URL', true)
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env.NIUNIU_TIMEOUT_MS) || 12000))
  const request = options.fetch || fetch

  async function fetchJson(url, label, referer) {
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
    const declaredSize = Number(response.headers.get('content-length'))
    if (declaredSize > MAX_RESPONSE_BYTES) throw providerError(`${label}响应过大`)
    const body = await response.arrayBuffer()
    if (body.byteLength > MAX_RESPONSE_BYTES) throw providerError(`${label}响应过大`)
    try { return JSON.parse(new TextDecoder().decode(body)) } catch { throw providerError(`${label}未返回有效数据`) }
  }

  async function search(input) {
    const title = String(input.title || '').trim().slice(0, 100)
    if (!title) return []
    const suggestUrl = new URL('/index.php/ajax/suggest', siteUrl)
    suggestUrl.searchParams.set('mid', '1')
    suggestUrl.searchParams.set('wd', title)
    suggestUrl.searchParams.set('limit', '100')
    const suggestions = await fetchJson(suggestUrl, '牛牛资源搜索', `${siteUrl}/`)
    const targetTitle = normalizedTitle(title)
    const ids = (Array.isArray(suggestions?.list) ? suggestions.list : [])
      .filter((item) => normalizedTitle(item?.name) === targetTitle)
      .map((item) => positiveInteger(item?.id))
      .filter(Boolean)
      .slice(0, 10)
    if (!ids.length) return []

    const detailUrl = new URL(apiUrl)
    detailUrl.searchParams.set('ac', 'detail')
    detailUrl.searchParams.set('ids', ids.join(','))
    const details = await fetchJson(detailUrl, '牛牛资源详情', `${siteUrl}/`)
    return normalizeNiuniuResults(details?.list, input)
  }

  return { id: 'niuniu', name: '牛牛资源', search }
}
