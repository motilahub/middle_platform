import crypto from 'node:crypto'

const PAN_TYPES = [
  { code: 2, storageType: 'baidu' },
  { code: 0, storageType: 'quark' },
  { code: 3, storageType: 'uc' },
  { code: 4, storageType: 'xunlei' },
]

const ALLOWED_LINK_HOSTS = new Set(['pan.baidu.com', 'pan.quark.cn', 'drive.uc.cn', 'pan.xunlei.com'])

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

export function parsePanSouDataLine(line) {
  const value = String(line || '').trim()
  if (!value.startsWith('data:')) return null
  const body = value.slice(5).trim()
  if (!body || body.startsWith('[DONE]')) return null
  try {
    const parsed = JSON.parse(body)
    return parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed
  } catch {
    return null
  }
}

async function readSearchStream(response, limit) {
  if (!response.body) return []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const results = []
  let buffer = ''
  let finished = false
  while (!finished && results.length < limit) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.includes('[DONE]')) { finished = true; break }
      const item = parsePanSouDataLine(line)
      if (item?.title && item?.url) results.push(item)
      if (results.length >= limit) break
    }
  }
  if (!finished) await reader.cancel().catch(() => {})
  return results
}

function normalizeBaseUrl(value) {
  const url = new URL(value || 'https://pansou.top')
  if (url.protocol !== 'https:') throw new Error('PANSOU_BASE_URL 必须使用 HTTPS')
  return url.origin
}

export function isAllowedPanLink(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_LINK_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function createPanSouProvider(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.PANSOU_BASE_URL)
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env.VIDEO_SEARCH_TIMEOUT_MS) || 12000))
  const perTypeLimit = Math.min(200, Math.max(1, Number(options.maxResults || process.env.VIDEO_SEARCH_MAX_RESULTS) || 100))
  const resolveCacheTtlMs = Math.min(30 * 60 * 1000, Math.max(0, Number(options.resolveCacheTtlMs ?? process.env.VIDEO_SEARCH_RESOLVE_CACHE_TTL_MS) || 5 * 60 * 1000))
  const resolveCacheMaxEntries = 500
  const request = options.fetch || fetch
  const resolvedLinks = new Map()
  const pendingResolutions = new Map()

  function resolutionKey(rawToken, title) {
    return crypto.createHash('sha256').update(`${rawToken}|${title || ''}`).digest('hex')
  }

  function cacheResolvedLink(key, link) {
    if (!resolveCacheTtlMs) return
    while (resolvedLinks.size >= resolveCacheMaxEntries) resolvedLinks.delete(resolvedLinks.keys().next().value)
    resolvedLinks.set(key, { link, expiresAt: Date.now() + resolveCacheTtlMs })
  }

  async function searchType(keyword, panType) {
    const url = new URL('/api/other/web_search', baseUrl)
    url.searchParams.set('title', keyword)
    url.searchParams.set('is_type', String(panType.code))
    const response = await request(url, {
      headers: { accept: 'text/event-stream' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw providerError(`天查${panType.storageType}线路返回 ${response.status}`)
    const items = await readSearchStream(response, perTypeLimit)
    return items.map((item) => ({
      id: crypto.createHash('sha256').update(`${panType.storageType}|${item.title}|${item.url}`).digest('hex').slice(0, 24),
      title: String(item.title).trim().slice(0, 300),
      provider: 'tiancha',
      providerName: '天查',
      storageType: panType.storageType,
      sourceLine: '默认',
      rawToken: String(item.url),
    }))
  }

  return {
    id: 'tiancha',
    name: '天查',
    async search(keyword) {
      const settled = await Promise.allSettled(PAN_TYPES.map((panType) => searchType(keyword, panType)))
      const seen = new Set()
      const results = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []).filter((item) => {
        const key = `${item.storageType}|${item.rawToken}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      const failed = settled.filter((item) => item.status === 'rejected').length
      if (!results.length && failed === PAN_TYPES.length) throw providerError('天查暂时无法访问')
      return { results, status: failed ? 'partial' : 'success', message: failed ? `${failed} 条网盘线路暂不可用` : undefined }
    },
    async resolve(rawToken, title) {
      if (!rawToken || rawToken.length > 4096) throw providerError('天查链接凭证无效', 400)
      const normalizedTitle = String(title || '').slice(0, 300)
      const key = resolutionKey(rawToken, normalizedTitle)
      const cached = resolvedLinks.get(key)
      if (cached?.expiresAt > Date.now()) return cached.link
      if (cached) resolvedLinks.delete(key)
      if (pendingResolutions.has(key)) return pendingResolutions.get(key)

      const resolution = (async () => {
        let response
        try {
          response = await request(new URL('/api/other/save_url', baseUrl), {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ url: encodeURIComponent(rawToken), title: normalizedTitle }),
            signal: AbortSignal.timeout(timeoutMs),
          })
        } catch (error) {
          if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError(`天查链接解析超过 ${Math.ceil(timeoutMs / 1000)} 秒，请稍后重试`, 504)
          throw providerError('暂时无法连接天查链接服务')
        }
        if (!response.ok) throw providerError('天查链接解析失败')
        let body
        try { body = await response.json() } catch { throw providerError('天查未返回有效的链接信息') }
        const link = body?.data?.url
        if (body?.code !== 200 || !link) throw providerError(body?.message || '天查链接解析失败')
        if (!isAllowedPanLink(link)) throw providerError('搜索源返回了不受信任的网盘地址')
        cacheResolvedLink(key, link)
        return link
      })()
      pendingResolutions.set(key, resolution)
      try {
        return await resolution
      } finally {
        pendingResolutions.delete(key)
      }
    },
  }
}
