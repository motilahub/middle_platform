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

function textFilters(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))].slice(0, 50)
}

function catalogType(value) {
  return ['movie', 'tv', 'anime'].includes(value) ? value : null
}

function catalogYear(value) {
  if (value === undefined || value === null || value === '') return null
  const year = Number(value)
  return Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null
}

function catalogPage(value, fallback = 1) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : fallback
}

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function optionalText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength) || null
}

const resourceTitleCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

export function compareResourceSearchResults(left, right) {
  return resourceTitleCollator.compare(String(left?.title || ''), String(right?.title || '')) ||
    (Number(right?.year) || 0) - (Number(left?.year) || 0) ||
    resourceTitleCollator.compare(String(left?.source || ''), String(right?.source || ''))
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
  const releaseDate = optionalText(body.releaseDate, 10)
  if (releaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || !Number.isFinite(Date.parse(`${releaseDate}T00:00:00Z`)) || new Date(`${releaseDate}T00:00:00Z`).toISOString().slice(0, 10) !== releaseDate)) throw failure('上映日期无效')
  const textList = (value, label) => {
    if (value == null) return []
    if (!Array.isArray(value) || value.length > 50 || value.some((item) => typeof item !== 'string' || item.trim().length > 100)) throw failure(`${label}无效`)
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
  }
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
    contentCategory: body.contentCategory === 'anime' ? 'anime' : 'general',
    releaseDate,
    runtimeMinutes: optionalNumber(body.runtimeMinutes, '时长', { integer: true, min: 1, max: 9999 }),
    genres: textList(body.genres, '类型'),
    countries: textList(body.countries, '地区'),
    languages: textList(body.languages, '语言'),
    directors: textList(body.directors, '导演'),
    castMembers: textList(body.castMembers, '演员'),
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
    const value = String(id)
    const item = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? await repository.get(value)
      : repository.getById ? await repository.getById(positiveId(value, '影片')) : await repository.get(value)
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
    async searchCatalog(input = {}) {
      const page = catalogPage(input.page)
      const pageSize = Math.min(50, Math.max(1, catalogPage(input.pageSize, 20)))
      const type = catalogType(input.type)
      const sort = input.sort === 'newest' ? 'newest' : 'default'
      const result = await repository.searchCatalog({
        type,
        keyword: searchKeyword(input.keyword ?? input.q),
        genres: textFilters(input.genres),
        countries: textFilters(input.countries),
        year: catalogYear(input.year),
        sort,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      return { ...result, page, pageSize, sort, type: type || 'all', keyword: searchKeyword(input.keyword ?? input.q) }
    },
    catalogFilters() { return repository.catalogFilters() },
    adminList(type, query) { return repository.list(type === 'all' || type === 'anime' ? null : mediaType(type), searchKeyword(query), true, type === 'anime' ? 'anime' : null) },
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
      const existing = repository.getById ? await repository.getById(itemId) : await repository.get(itemId)
      if (!existing) throw failure('影片不存在', 404)
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

    async searchResources(query) {
      const keyword = searchKeyword(query)
      if (!keyword) throw failure('请输入影视名称')
      const providers = [doubanProvider, options.tmdbProvider].filter(Boolean)
      const settled = await Promise.allSettled(providers.map(async (provider) => {
        if (provider.configured === false) throw failure('未配置 TMDB_ACCESS_TOKEN 或 TMDB_API_KEY', 503)
        const results = await provider.search(keyword)
        const existing = await repository.existingExternalIds(provider.id, results.map((item) => item.externalId))
        return results.map((item) => ({ ...item, source: provider.id, inLibrary: existing.has(item.externalId) }))
      }))
      return {
        results: settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : []).sort(compareResourceSearchResults),
        providers: settled.map((entry, index) => ({
          source: providers[index].id, name: providers[index].name,
          status: entry.status === 'fulfilled' ? 'success' : providers[index].configured === false ? 'unconfigured' : 'failed',
          ...(entry.status === 'rejected' ? { message: entry.reason?.message || '搜索失败' } : {}),
        })),
      }
    },

    async searchDouban(query) {
      const results = await doubanProvider.search(searchKeyword(query))
      const existing = await repository.existingExternalIds('douban', results.map((item) => item.externalId))
      return results.map((item) => ({ ...item, source: 'douban', inLibrary: existing.has(item.externalId) }))
    },

    async importResource(body) {
      const type = mediaType(body.mediaType)
      const source = body.source || 'douban'
      if (!['douban', 'tmdb'].includes(source)) throw failure('影视来源无效')
      const externalId = String(body.externalId || '').trim()
      if (!/^[1-9]\d*$/.test(externalId)) throw failure('影视 ID 无效')
      const provider = source === 'tmdb' ? options.tmdbProvider : doubanProvider
      if (!provider) throw failure('影视来源未配置', 503)
      const detail = await provider.get(type, externalId)
      const result = await repository.importItem(detail)
      return { ...result, message: result.inserted ? '已加入影视库' : '影视信息已更新' }
    },

    importDouban(body) { return this.importResource({ ...body, source: 'douban' }) },

    async searchPlayable(body) {
      const mediaId = positiveId(body.mediaId, '影片')
      const item = repository.getById ? await repository.getById(mediaId) : await repository.get(mediaId)
      if (!item) throw failure('影片不存在', 404)
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
