const MAX_POSTER_BYTES = 5 * 1024 * 1024
const DOUBAN_IMAGE_HOST = /(^|\.)doubanio\.com$/i
const ALLOWED_IMAGE_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'])

function posterError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

function validatePosterUrl(value) {
  let url
  try { url = new URL(value) } catch { throw posterError('海报地址无效') }
  if (url.protocol !== 'https:' || url.username || url.password || !DOUBAN_IMAGE_HOST.test(url.hostname)) {
    throw posterError('海报来源不受支持')
  }
  return url
}

async function readLimitedBody(response) {
  if (!response.body) throw posterError('海报文件无效')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_POSTER_BYTES) {
      await reader.cancel()
      throw posterError('海报文件过大')
    }
    chunks.push(Buffer.from(value))
  }
  if (!total) throw posterError('海报文件无效')
  return Buffer.concat(chunks, total)
}

export function createPosterProxy(options = {}) {
  const request = options.fetch || fetch
  const timeoutMs = Math.min(15000, Math.max(1000, Number(options.timeoutMs) || 8000))

  return {
    async fetch(value) {
      const url = validatePosterUrl(value)
      let response
      try {
        response = await request(url, {
          headers: {
            accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
            referer: 'https://movie.douban.com/',
            'user-agent': 'Mozilla/5.0 (compatible; MotilaMediaLibrary/1.0)',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw posterError('海报加载超时', 504)
        throw posterError('海报暂时无法加载')
      }
      if (!response.ok) throw posterError(`海报服务返回 ${response.status}`)
      const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw posterError('海报服务未返回受支持的图片')
      const declaredSize = Number(response.headers.get('content-length'))
      if (Number.isFinite(declaredSize) && declaredSize > MAX_POSTER_BYTES) throw posterError('海报文件过大')
      const body = await readLimitedBody(response)
      return { body, contentType }
    },
  }
}
