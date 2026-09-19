import crypto from 'node:crypto'

function normalizePlayableUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function playbackType(url, declaredType) {
  if (declaredType === 'hls' || declaredType === 'direct') return declaredType
  return new URL(url).pathname.toLowerCase().endsWith('.m3u8') ? 'hls' : 'direct'
}

export function createPlayableSearch(providers = [], options = {}) {
  const ttlMs = Math.min(30 * 60 * 1000, Math.max(0, Number(options.ttlMs) || 10 * 60 * 1000))
  const cache = new Map()

  async function search(input) {
    const keyword = input.episode
      ? `${input.title} 第${String(input.episode).padStart(2, '0')}集`
      : `${input.title}${input.year ? ` ${input.year}` : ''}`
    const cacheKey = `${input.mediaId}|${input.season || 1}|${input.episode || 0}`
    const cached = cache.get(cacheKey)
    if (cached?.expiresAt > Date.now()) return cached.value
    if (cached) cache.delete(cacheKey)

    const settled = await Promise.allSettled(providers.map(async (provider) => ({
      provider,
      results: await provider.search({ ...input, keyword }),
    })))
    const providerStates = []
    const results = []
    settled.forEach((entry, index) => {
      const provider = providers[index]
      if (entry.status === 'rejected') {
        providerStates.push({ id: provider.id, name: provider.name, status: 'failed', message: entry.reason?.message || '搜索失败' })
        return
      }
      let count = 0
      for (const item of entry.value.results || []) {
        const url = normalizePlayableUrl(item.url)
        if (!url) continue
        count += 1
        results.push({
          id: crypto.createHash('sha256').update(`${provider.id}|${url}`).digest('hex').slice(0, 24),
          provider: provider.id,
          providerName: provider.name,
          title: String(item.title || input.title).trim().slice(0, 300),
          type: playbackType(url, item.type),
          url,
        })
      }
      providerStates.push({ id: provider.id, name: provider.name, status: 'success', count })
    })
    const value = {
      keyword,
      results,
      providers: providerStates,
      message: providers.length ? undefined : '尚未配置在线播放来源',
    }
    if (ttlMs) cache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs })
    return value
  }

  return { search }
}
