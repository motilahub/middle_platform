import crypto from 'node:crypto'

const PAN_TYPES = [
  { code: 2, storageType: 'baidu' },
  { code: 0, storageType: 'quark' },
  { code: 3, storageType: 'uc' },
  { code: 4, storageType: 'xunlei' },
  { code: 10, storageType: 'guangya' },
]

const ALLOWED_LINK_HOSTS = new Set(['pan.baidu.com', 'pan.quark.cn', 'drive.uc.cn', 'pan.xunlei.com', 'www.guangyapan.com'])

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function parseStreamPayload(line) {
  const value = String(line || '').trim()
  if (!value.startsWith('data:')) return null
  const body = value.slice(5).trim()
  if (!body || body.startsWith('[DONE]')) return null
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

export function parsePanSouDataLine(line) {
  const parsed = parseStreamPayload(line)
  return parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed
}

async function* readResponseLines(response) {
  if (!response.body) throw providerError('天查未返回有效的数据流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) yield line
      if (done) {
        if (buffer) yield buffer
        return
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function readSearchStream(response, limit) {
  const results = []
  const seen = new Set()
  let sourceLine = '默认'
  for await (const line of readResponseLines(response)) {
    if (/^data:\s*\[DONE\]/.test(line)) break
    if (line.trim().startsWith('线路：')) {
      sourceLine = line.trim().slice(3).trim().slice(0, 100) || '默认'
      continue
    }
    const item = parsePanSouDataLine(line)
    if (typeof item?.title !== 'string' || !item.title.trim() || typeof item?.url !== 'string' || !item.url || seen.has(item.url)) continue
    seen.add(item.url)
    results.push({ ...item, sourceLine: String(item.source || sourceLine).slice(0, 100) })
    if (results.length >= limit) break
  }
  return results
}

async function readResolutionStream(response) {
  for await (const line of readResponseLines(response)) {
    if (/^data:\s*\[DONE\]/.test(line)) break
    const event = parseStreamPayload(line)
    if (event?.type === 'error') throw providerError(event.message || '天查链接解析失败')
    if (event?.type === 'done') {
      if (!event.data?.url) throw providerError('天查未返回有效的链接信息')
      return event.data.url
    }
  }
  return null
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
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env.VIDEO_SEARCH_TIMEOUT_MS) || 30000))
  const perTypeLimit = Math.min(200, Math.max(1, Number(options.maxResults || process.env.VIDEO_SEARCH_MAX_RESULTS) || 100))
  const resolveCacheTtlMs = Math.min(5 * 60 * 1000, Math.max(0, Number(options.resolveCacheTtlMs ?? process.env.VIDEO_SEARCH_RESOLVE_CACHE_TTL_MS) || 0))
  const resolveCacheMaxEntries = 500
  const request = options.fetch || fetch
  const resolvedLinks = new Map()
  const pendingResolutions = new Map()

  function resolutionKey(rawToken, title, stoken) {
    return crypto.createHash('sha256').update(JSON.stringify([rawToken, title, stoken])).digest('hex')
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
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel().catch(() => {})
      throw providerError('天查未返回有效的搜索数据流')
    }
    const items = await readSearchStream(response, perTypeLimit)
    return items.map((item) => ({
      id: crypto.createHash('sha256').update(`${panType.storageType}|${item.title}|${item.url}`).digest('hex').slice(0, 24),
      title: String(item.title).trim().slice(0, 300),
      provider: 'tiancha',
      providerName: '天查',
      storageType: panType.storageType,
      sourceLine: item.sourceLine,
      rawToken: String(item.url),
      stoken: typeof item.stoken === 'string' ? item.stoken : '',
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
    async resolve(rawToken, title, stoken = '') {
      if (!rawToken || rawToken.length > 4096) throw providerError('天查链接凭证无效', 400)
      if (typeof stoken !== 'string' || stoken.length > 8192) throw providerError('天查分享凭证无效', 400)
      const normalizedTitle = String(title || '').slice(0, 300)
      const key = resolutionKey(rawToken, normalizedTitle, stoken)
      const cached = resolvedLinks.get(key)
      if (cached?.expiresAt > Date.now()) return cached.link
      if (cached) resolvedLinks.delete(key)
      if (pendingResolutions.has(key)) return pendingResolutions.get(key)

      const resolution = (async () => {
        const signal = AbortSignal.timeout(timeoutMs)
        const body = JSON.stringify({ url: encodeURIComponent(rawToken), title: normalizedTitle, stoken })
        let link
        try {
          // Old deployments and interrupted streams retain the source site's JSON fallback.
          try {
            const response = await request(new URL('/api/other/save_url_stream', baseUrl), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
              body,
              signal,
            })
            if (response.ok && response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
              link = await readResolutionStream(response)
            } else {
              await response.body?.cancel().catch(() => {})
              if (!response.ok && ![404, 405, 501].includes(response.status)) throw providerError(`天查链接解析失败（${response.status}）`)
            }
          } catch (error) {
            if (error?.status || signal.aborted || ['TimeoutError', 'AbortError'].includes(error?.name)) throw error
          }
          if (!link) {
            const response = await request(new URL('/api/other/save_url', baseUrl), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body,
              signal,
            })
            if (!response.ok) throw providerError('天查链接解析失败')
            let payload
            try { payload = await response.json() } catch { throw providerError('天查未返回有效的链接信息') }
            link = payload?.data?.url
            if (payload?.code !== 200 || !link) throw providerError(payload?.message || '天查链接解析失败')
          }
        } catch (error) {
          if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError(`天查链接解析超过 ${Math.ceil(timeoutMs / 1000)} 秒，请稍后重试`, 504)
          if (error?.status) throw error
          throw providerError('暂时无法连接天查链接服务')
        }
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
