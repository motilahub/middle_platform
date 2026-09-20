import crypto from 'node:crypto'

function mediaType(value) {
  if (value !== 'movie' && value !== 'tv') throw Object.assign(new Error('影视类型无效'), { status: 400 })
  return value
}

function positiveId(value, label = '记录') {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw Object.assign(new Error(`${label}不存在`), { status: 404 })
  return id
}

function searchKeyword(value) {
  return String(value || '').trim().slice(0, 100)
}

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function optionalText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength) || null
}

function optionalNumber(value, label, { integer = false, min = 0, max } = {}) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < min || (max !== undefined && number > max)) {
    throw failure(`${label}无效`)
  }
  return number
}

function optionalUrl(value, label) {
  const text = optionalText(value, 2000)
  if (!text) return null
  let url
  try { url = new URL(text) } catch { throw failure(`${label}无效`) }
  if (!['http:', 'https:'].includes(url.protocol)) throw failure(`${label}仅支持 HTTP/HTTPS`)
  return url.toString()
}

function editableItem(body) {
  const type = mediaType(body.mediaType)
  const title = String(body.title || '').trim().slice(0, 300)
  if (!title) throw failure('影视名称不能为空')
  const totalEpisodeCount = type === 'tv' ? optionalNumber(body.totalEpisodeCount, '总集数', { integer: true, min: 1, max: 9999 }) : null
  const availableEpisodeCount = type === 'tv' ? optionalNumber(body.availableEpisodeCount, '已更新集数', { integer: true, min: 1, max: 9999 }) : null
  if (totalEpisodeCount && availableEpisodeCount && availableEpisodeCount > totalEpisodeCount) throw failure('已更新集数不能超过总集数')
  const episodeStatus = type !== 'tv' || !availableEpisodeCount
    ? 'unknown'
    : totalEpisodeCount && availableEpisodeCount >= totalEpisodeCount ? 'completed' : 'updating'
  return {
    mediaType: type,
    title,
    originalTitle: optionalText(body.originalTitle, 300),
    year: optionalNumber(body.year, '年份', { integer: true, min: 1800, max: 2200 }),
    posterUrl: optionalUrl(body.posterUrl, '海报地址'),
    rating: optionalNumber(body.rating, '评分', { min: 0, max: 10 }),
    summary: optionalText(body.summary, 5000),
    totalEpisodeCount,
    availableEpisodeCount,
    episodeCount: availableEpisodeCount || totalEpisodeCount,
    episodeStatus,
    sourceUrl: optionalUrl(body.sourceUrl, '来源链接'),
  }
}

function itemIds(values) {
  const ids = [...new Set((Array.isArray(values) ? values : []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))]
  if (!ids.length) throw failure('请选择要删除的影视')
  if (ids.length > 500) throw failure('单次最多删除 500 条影视')
  return ids
}

export function createMediaLibraryService(repository, doubanProvider, playableSearch, options = {}) {
  const syncLimit = Math.min(250, Math.max(1, Number(options.syncLimit || process.env.MEDIA_LIBRARY_SYNC_LIMIT) || 250))
  let syncPromise
  let progressPromise

  const get = async (id) => {
    const item = await repository.get(positiveId(id, '影片'))
    if (!item) throw Object.assign(new Error('影片不存在'), { status: 404 })
    return item
  }

  const refreshEpisodeProgress = () => {
    if (progressPromise) return progressPromise
    progressPromise = (async () => {
      const items = await repository.listEpisodeSources()
      let nextIndex = 0
      const results = []
      const worker = async () => {
        while (nextIndex < items.length) {
          const item = items[nextIndex++]
          try {
            const detail = await doubanProvider.get('tv', item.externalId)
            await repository.updateEpisodeProgress(detail)
            results.push({ id: item.id, externalId: item.externalId, status: 'success' })
          } catch (error) {
            results.push({ id: item.id, externalId: item.externalId, status: 'failed', message: error?.message || '刷新失败' })
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker))
      return {
        count: items.length,
        updated: results.filter((item) => item.status === 'success').length,
        failed: results.filter((item) => item.status === 'failed').length,
        syncedAt: new Date().toISOString(),
      }
    })().finally(() => { progressPromise = undefined })
    return progressPromise
  }

  return {
    list(type, query) { return repository.list(mediaType(type), searchKeyword(query)) },
    adminList(type, query) { return repository.list(type === 'all' ? null : mediaType(type), searchKeyword(query), true) },
    get,
    refreshEpisodeProgress,

    async createItem(body) {
      return repository.createItem({
        ...editableItem(body),
        source: 'manual',
        externalId: crypto.randomUUID(),
      })
    },

    async updateItem(id, body) {
      const itemId = positiveId(id, '影片')
      if (!await repository.get(itemId)) throw failure('影片不存在', 404)
      return repository.updateItem(itemId, editableItem(body))
    },

    async deleteItems(ids) {
      const deleted = await repository.deleteItems(itemIds(ids))
      return { deleted }
    },

    async getPoster(id) {
      const item = await get(id)
      if (!item.posterUrl) throw Object.assign(new Error('影片暂无海报'), { status: 404 })
      return options.posterProxy.fetch(item.posterUrl)
    },

    getExternalPoster(url) { return options.posterProxy.fetch(url) },

    sync() {
      if (syncPromise) return syncPromise
      syncPromise = (async () => {
        const settled = await Promise.allSettled(['movie', 'tv'].map(async (type) => {
          const items = await doubanProvider.list(type, syncLimit)
          return { type, count: items.length, ...await repository.sync(type, items) }
        }))
        const sources = settled.map((entry, index) => entry.status === 'fulfilled'
          ? { ...entry.value, status: 'success' }
          : { type: index === 0 ? 'movie' : 'tv', status: 'failed', count: 0, inserted: 0, updated: 0, message: entry.reason?.message || '同步失败' })
        if (sources.every((source) => source.status === 'failed')) throw Object.assign(new Error('电影和电视剧榜单均同步失败'), { status: 502, sources })
        const episodeProgress = sources.some((source) => source.type === 'tv' && source.status === 'success')
          ? await refreshEpisodeProgress()
          : undefined
        return { sources, episodeProgress, syncedAt: new Date().toISOString() }
      })().finally(() => { syncPromise = undefined })
      return syncPromise
    },

    async searchDouban(query) {
      const results = await doubanProvider.search(searchKeyword(query))
      const existing = await repository.existingExternalIds(results.map((item) => item.externalId))
      return results.map((item) => ({ ...item, inLibrary: existing.has(item.externalId) }))
    },

    async importDouban(body) {
      const type = mediaType(body.mediaType)
      const externalId = String(body.externalId || '').trim()
      if (!/^\d+$/.test(externalId)) throw Object.assign(new Error('豆瓣 ID 无效'), { status: 400 })
      const detail = await doubanProvider.get(type, externalId)
      const result = await repository.importItem(detail)
      return { ...result, message: result.inserted ? '已加入影视库' : '影视信息已更新' }
    },

    async searchPlayable(body) {
      const item = await get(body.mediaId)
      const episode = body.episode === undefined || body.episode === null ? null : positiveId(body.episode, '集数')
      if (item.mediaType === 'movie' && episode) throw Object.assign(new Error('电影不支持选择集数'), { status: 400 })
      if (item.mediaType === 'tv' && !episode) throw Object.assign(new Error('请选择集数'), { status: 400 })
      const episodeLimit = item.totalEpisodeCount || item.availableEpisodeCount || item.episodeCount
      if (episodeLimit && episode > episodeLimit) {
        throw Object.assign(new Error(`集数不能超过 ${episodeLimit}`), { status: 400 })
      }
      return playableSearch.search({ mediaId: item.id, title: item.title, year: item.year, season: 1, episode })
    },
  }
}
