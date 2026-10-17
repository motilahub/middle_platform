import crypto from 'node:crypto'

const DEFAULT_API_URL = 'http://localhost:8888/api/search'
const MAX_URL_LENGTH = 4096
const ALLOWED_LINK_HOSTS = new Set([
  'pan.baidu.com', 'aliyundrive.com', 'www.aliyundrive.com', 'alipan.com', 'www.alipan.com',
  'pan.quark.cn', 'drive.uc.cn', 'pan.xunlei.com', 'www.guangyapan.com',
  '115.com', '115cdn.com', 'mypikpak.com', '123pan.com', 'www.123pan.com',
  'tianyi.aliyun.com', 'cloud.189.cn',
])

function providerError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function normalizeApiUrl(value) {
  let url
  try { url = new URL(value || DEFAULT_API_URL) } catch { throw new Error('网盘搜索源地址不是有效 URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('网盘搜索源地址必须使用 HTTP 或 HTTPS')
  if (url.username || url.password || url.search || url.hash) throw new Error('网盘搜索源地址不能包含账号、查询参数或片段')
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url.toString().replace(/\/$/, '')
}

export function isAllowedPanLink(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'magnet:' || url.protocol === 'ed2k:') return true
    return url.protocol === 'https:' && [...ALLOWED_LINK_HOSTS].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch { return false }
}

function storageLabel(type) {
  return {
    baidu: '百度', aliyun: '阿里云', quark: '夸克', guangya: '光鸭', tianyi: '天翼云',
    uc: 'UC', mobile: '移动云盘', 115: '115', pikpak: 'PikPak', xunlei: '迅雷',
    123: '123云盘', magnet: '磁力', ed2k: '电驴',
  }[type] || type
}

function resultTitle(item, url) {
  const note = String(item?.note || '').trim()
  const password = String(item?.password || '').trim()
  if (!password) return note || url
  return `${note || url}（提取码：${password}）`.slice(0, 300)
}

export function parsePanSouResponse(payload) {
  if (!payload || payload.code !== 0) throw providerError(payload?.message || 'PanSou 搜索失败')
  const merged = payload.data?.merged_by_type
  if (!merged || typeof merged !== 'object') return []
  const results = []
  const seen = new Set()
  for (const [storageType, links] of Object.entries(merged)) {
    if (!Array.isArray(links)) continue
    for (const item of links) {
      const url = String(item?.url || '').trim()
      if (!url || !isAllowedPanLink(url) || seen.has(`${storageType}|${url}`)) continue
      seen.add(`${storageType}|${url}`)
      results.push({
        id: crypto.createHash('sha256').update(`${storageType}|${url}`).digest('hex').slice(0, 24),
        title: resultTitle(item, url),
        provider: 'pansou',
        providerName: 'PanSou',
        storageType,
        sourceLine: String(item?.source || storageLabel(storageType)).slice(0, 100),
        linkMode: 'direct',
        url,
      })
    }
  }
  return results
}

export function createPanSouProvider(options = {}) {
  const timeoutMs = Math.min(30000, Math.max(1000, Number(options.timeoutMs || process.env.VIDEO_SEARCH_TIMEOUT_MS) || 30000))
  const request = options.fetch || fetch
  const getBaseUrl = options.getBaseUrl || (() => options.baseUrl || DEFAULT_API_URL)

  return {
    id: 'pansou',
    name: 'PanSou',
    async search(keyword) {
      let apiUrl
      try { apiUrl = normalizeApiUrl(await getBaseUrl()) } catch (error) { throw providerError(error.message, 500) }
      let response
      try {
        response = await request(apiUrl, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ kw: keyword, res: 'merge', src: 'all', cloud_types: [] }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw providerError(`搜索服务响应超时（${Math.ceil(timeoutMs / 1000)} 秒），请稍后重试`, 504)
        throw providerError('搜索服务暂时无法连接')
      }
      if (!response.ok) throw providerError(`搜索服务暂时不可用（${response.status}）`)
      let payload
      try { payload = await response.json() } catch { throw providerError('搜索服务返回了无效数据') }
      const results = parsePanSouResponse(payload)
      return { results, status: 'success' }
    },
    async resolve(rawToken) {
      if (!rawToken || String(rawToken).length > MAX_URL_LENGTH || !isAllowedPanLink(rawToken)) throw providerError('网盘链接无效', 400)
      return rawToken
    },
  }
}
