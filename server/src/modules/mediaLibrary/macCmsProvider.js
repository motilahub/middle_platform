const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

const PROVIDER_DEFAULTS = {
  baofeng: {
    id: 'baofeng',
    name: '暴风资源',
    apiUrl: 'https://bfzyapi.com/api.php/provide/vod/',
    apiEnv: 'BAOFENG_API_URL',
    timeoutEnv: 'BAOFENG_TIMEOUT_MS',
    playbackFlags: ['bfzym3u8'],
  },
  yzy1080: {
    id: 'yzy1080',
    name: '1080影视',
    apiUrl: 'https://api.yyzy-tv.vip/inc/apijson.php',
    apiEnv: 'YZY1080_API_URL',
    timeoutEnv: 'YZY1080_TIMEOUT_MS',
    playbackFlags: ['1080zyk'],
  },
  xinlang: {
    id: 'xinlang',
    name: '新浪资源',
    apiUrl: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/from/xlm3u8/',
    apiEnv: 'XINLANG_API_URL',
    timeoutEnv: 'XINLANG_TIMEOUT_MS',
    playbackFlags: ['xlm3u8'],
  },
  feifan: {
    id: 'feifan',
    name: '非凡资源',
    apiUrl: 'https://ffzy5.tv/api.php/provide/vod/',
    apiEnv: 'FEIFAN_API_URL',
    timeoutEnv: 'FEIFAN_TIMEOUT_MS',
    playbackFlags: ['ffm3u8'],
  },
  zy360: {
    id: 'zy360',
    name: '360资源',
    apiUrl: 'https://360zyzz.com/api.php/provide/vod/',
    apiEnv: 'ZY360_API_URL',
    timeoutEnv: 'ZY360_TIMEOUT_MS',
    playbackFlags: ['360zy'],
  },
}

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function normalizeEndpoint(value, fallback, label) {
  const url = new URL(String(value || fallback).trim())
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label}必须是无认证信息的 HTTPS 地址`)
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

function isDirectHls(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.pathname.toLowerCase().endsWith('.m3u8') && !url.username && !url.password
  } catch {
    return false
  }
}

function parseEntries(value) {
  return String(value || '').split('#').flatMap((entry, index) => {
    const separator = entry.indexOf('$')
    if (separator <= 0) return []
    const label = entry.slice(0, separator).trim()
    const url = entry.slice(separator + 1).trim()
    if (!label || !isDirectHls(url)) return []
    return [{ label, url, episode: entryEpisode(label), index }]
  })
}

export function normalizeMacCmsResults(records, input, playbackFlags) {
  const targetTitle = normalizedTitle(input.title)
  const requestedYear = positiveInteger(input.year)
  const requestedEpisode = positiveInteger(input.episode)
  const allowedFlags = new Set((playbackFlags || []).map((flag) => String(flag).trim().toLowerCase()))
  const seenUrls = new Set()
  const results = []

  for (const record of Array.isArray(records) ? records : []) {
    const title = String(record?.vod_name || '').trim()
    if (!title || normalizedTitle(title) !== targetTitle) continue
    const year = positiveInteger(record?.vod_year)
    if (requestedYear && year && requestedYear !== year) continue

    const sources = String(record?.vod_play_from || '').split('$$$')
    const groups = String(record?.vod_play_url || '').split('$$$')
    sources.forEach((source, sourceIndex) => {
      if (!allowedFlags.has(source.trim().toLowerCase())) return
      const entries = parseEntries(groups[sourceIndex])
      const selected = requestedEpisode
        ? entries.filter((entry) => entry.episode === requestedEpisode)
        : entries.slice(0, 6)
      const fallback = requestedEpisode && !selected.length && entries.every((entry) => entry.episode === null)
        ? entries[requestedEpisode - 1] : null
      for (const entry of selected.length ? selected : fallback ? [fallback] : []) {
        if (seenUrls.has(entry.url)) continue
        seenUrls.add(entry.url)
        results.push({ title: `${title} · ${entry.label}`, url: entry.url, type: 'hls' })
      }
    })
  }
  return results
}

export function createMacCmsProvider(config, options = {}) {
  const apiUrl = normalizeEndpoint(
    options.apiUrl || process.env[config.apiEnv],
    config.apiUrl,
    config.apiEnv,
  )
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env[config.timeoutEnv]) || 12000))
  const request = options.fetch || fetch
  const referer = new URL(apiUrl).origin + '/'

  async function fetchJson(url) {
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
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError(`${config.name}搜索请求超时`, 504)
      throw providerError(`暂时无法连接${config.name}`)
    }
    if (!response.ok) throw providerError(`${config.name}搜索返回 ${response.status}`)
    const declaredSize = Number(response.headers.get('content-length'))
    if (declaredSize > MAX_RESPONSE_BYTES) throw providerError(`${config.name}搜索响应过大`)
    const body = await response.arrayBuffer()
    if (body.byteLength > MAX_RESPONSE_BYTES) throw providerError(`${config.name}搜索响应过大`)
    try { return JSON.parse(new TextDecoder().decode(body)) } catch { throw providerError(`${config.name}搜索未返回有效数据`) }
  }

  async function search(input) {
    const title = String(input.title || '').trim().slice(0, 100)
    if (!title) return []
    const detailUrl = new URL(apiUrl)
    detailUrl.searchParams.set('ac', 'detail')
    detailUrl.searchParams.set('wd', title)
    const details = await fetchJson(detailUrl)
    return normalizeMacCmsResults(details?.list, input, config.playbackFlags)
  }

  return { id: config.id, name: config.name, search }
}

export function createBaofengProvider(options = {}) {
  return createMacCmsProvider(PROVIDER_DEFAULTS.baofeng, options)
}

export function createYzy1080Provider(options = {}) {
  return createMacCmsProvider(PROVIDER_DEFAULTS.yzy1080, options)
}

export function createXinlangProvider(options = {}) {
  return createMacCmsProvider(PROVIDER_DEFAULTS.xinlang, options)
}

export function createFeifanProvider(options = {}) {
  return createMacCmsProvider(PROVIDER_DEFAULTS.feifan, options)
}

export function createZy360Provider(options = {}) {
  return createMacCmsProvider(PROVIDER_DEFAULTS.zy360, options)
}
