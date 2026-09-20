import assert from 'node:assert/strict'
import test from 'node:test'
import { createDoubanProvider, episodeCountFrom, episodeProgressFrom, normalizeDoubanDetail, normalizeDoubanItems, normalizeDoubanSearch } from './doubanProvider.js'
import { createBaofengProvider, createFeifanProvider, createXinlangProvider, createYzy1080Provider, createZy360Provider, normalizeMacCmsResults } from './macCmsProvider.js'
import { createNiuniuProvider, normalizeNiuniuResults } from './niuniuProvider.js'
import { createPlayableSearch } from './playableSearch.js'
import { createPosterProxy } from './posterProxy.js'
import { createMediaLibraryService } from './service.js'
import { createTmdbProvider, normalizeTmdbDetail, normalizeTmdbSearch } from './tmdbProvider.js'
import { createMediaLibraryRepository } from './repository.js'

test('TMDB 搜索只返回影视并保留同名不同年份和动漫形态', () => {
  const results = normalizeTmdbSearch({ results: [
    { id: 27, media_type: 'movie', title: '同名电影', release_date: '2000-01-01', poster_path: '/abc.jpg', vote_average: 7.5 },
    { id: 28, media_type: 'tv', name: '同名电影', first_air_date: '2025-02-02', overview: '动画剧集' },
    { id: 29, media_type: 'person', name: '某演员' },
  ] })
  assert.deepEqual(results.map((entry) => [entry.source, entry.externalId, entry.year, entry.mediaType]), [
    ['tmdb', '27', 2000, 'movie'], ['tmdb', '28', 2025, 'tv'],
  ])
  assert.equal(results[0].posterUrl, 'https://image.tmdb.org/t/p/w500/abc.jpg')
  assert.equal(results[1].posterUrl, null)
})

test('TMDB 详情映射标准字段及动漫剧集总数', () => {
  const item = normalizeTmdbDetail({
    id: 28, name: '动漫剧集', original_name: 'Anime', first_air_date: '2025-03-04', number_of_episodes: 24,
    episode_run_time: [23], genres: [{ id: 16, name: '动画' }],
    production_countries: [{ name: '日本' }], spoken_languages: [{ name: '日语' }],
    created_by: [{ name: '创作者' }], credits: { cast: [{ name: '声优' }] },
  }, 'tv')
  assert.equal(item.contentCategory, 'anime')
  assert.equal(item.mediaType, 'tv')
  assert.equal(item.totalEpisodeCount, 24)
  assert.equal(item.availableEpisodeCount, null)
  assert.equal(item.releaseDate, '2025-03-04')
  assert.equal(item.runtimeMinutes, 23)
  assert.deepEqual(item.directors, ['创作者'])
  assert.deepEqual(item.castMembers, ['声优'])
})

test('TMDB 使用服务端凭据获取搜索和详情，错误不泄漏凭据', async () => {
  const requests = []
  const provider = createTmdbProvider({ accessToken: 'test-secret', apiKey: '', fetch: async (url, options) => {
    requests.push({ url: new URL(url), options })
    if (String(url).includes('search/multi')) return Response.json({ results: [{ id: 10, title: '电影', media_type: 'movie' }] })
    return Response.json({ id: 10, title: '电影', runtime: 120, credits: { crew: [{ job: 'Director', name: '导演' }] } })
  } })
  assert.equal((await provider.search('电影'))[0].externalId, '10')
  assert.deepEqual((await provider.get('movie', '10')).directors, ['导演'])
  assert.equal(requests[0].url.searchParams.get('api_key'), null)
  assert.equal(requests[0].url.searchParams.get('language'), 'zh-CN')
  assert.equal(requests[0].options.headers.authorization, 'Bearer test-secret')
  assert.equal(requests[1].url.searchParams.get('append_to_response'), 'credits')
  const unauthorized = createTmdbProvider({ accessToken: 'test-secret', apiKey: '', fetch: async () => new Response('', { status: 401 }) })
  await assert.rejects(unauthorized.search('电影'), (error) => error.message === 'TMDB 凭据无效' && !error.message.includes('test-secret'))
})

test('TMDB API Key 模式只发往官方接口', async () => {
  const provider = createTmdbProvider({ accessToken: '', apiKey: 'test-key', fetch: async (url, options) => {
    assert.equal(new URL(url).hostname, 'api.themoviedb.org')
    assert.equal(new URL(url).searchParams.get('api_key'), 'test-key')
    assert.equal(options.headers.authorization, undefined)
    return Response.json({ results: [] })
  } })
  assert.deepEqual(await provider.search('电影'), [])
  await assert.rejects(provider.get('movie', '../bad'), /TMDB 条目无效/)
})

test('海报代理允许指定规格 TMDB 图片且拒绝非预期地址', async () => {
  const requested = []
  const proxy = createPosterProxy({ fetch: async (url, options) => {
    requested.push([String(url), options.headers.referer])
    return new Response(new Uint8Array([0xff, 0xd8]), { headers: { 'content-type': 'image/jpeg' } })
  } })
  await proxy.fetch('https://image.tmdb.org/t/p/w500/abc.jpg')
  assert.equal(requested[0][1], 'https://www.themoviedb.org/')
  await assert.rejects(proxy.fetch('https://image.tmdb.org/t/p/original/abc.jpg'), /海报来源不受支持/)
  await assert.rejects(proxy.fetch('https://image.tmdb.org.evil.com/t/p/w500/abc.jpg'), /海报来源不受支持/)
})

test('双来源搜索彼此隔离故障及同号条目的已入库状态', async () => {
  const lookups = []
  const repository = { existingExternalIds: async (source, ids) => {
    lookups.push([source, ids])
    return source === 'douban' ? new Set(['123']) : new Set()
  } }
  const douban = { id: 'douban', name: '豆瓣', search: async () => [{ externalId: '123', mediaType: 'movie' }] }
  const tmdb = { id: 'tmdb', name: 'TMDB', configured: true, search: async () => [{ externalId: '123', mediaType: 'movie' }] }
  const service = createMediaLibraryService(repository, douban, createPlayableSearch(), { tmdbProvider: tmdb })
  const output = await service.searchResources('电影')
  assert.deepEqual(output.results.map((entry) => [entry.source, entry.inLibrary]), [['douban', true], ['tmdb', false]])
  assert.deepEqual(lookups, [['douban', ['123']], ['tmdb', ['123']]])
  tmdb.search = async () => { throw new Error('暂时不可用') }
  const partial = await service.searchResources('电影')
  assert.equal(partial.results.length, 1)
  assert.equal(partial.providers[1].status, 'failed')
  tmdb.configured = false
  assert.equal((await service.searchResources('电影')).providers[1].status, 'unconfigured')
  await assert.rejects(service.searchResources('  '), /请输入影视名称/)
})

test('入库使用选择的来源重新读取详情并按来源唯一键查询', async () => {
  const imported = []
  const repository = {
    importItem: async (item) => { imported.push(item); return { item, inserted: true } },
  }
  const douban = { get: async () => ({ source: 'douban', externalId: '123' }) }
  const tmdb = { get: async (type, id) => ({ source: 'tmdb', externalId: id, mediaType: type, title: '服务端标题' }) }
  const service = createMediaLibraryService(repository, douban, createPlayableSearch(), { tmdbProvider: tmdb })
  await service.importResource({ source: 'tmdb', mediaType: 'movie', externalId: '123', title: '伪造的标题' })
  assert.equal(imported[0].title, '服务端标题')
  await assert.rejects(service.importResource({ source: 'other', mediaType: 'movie', externalId: '123' }), /影视来源无效/)
  const queries = []
  const repo = createMediaLibraryRepository({ query: async (sql, params) => { queries.push(params); return { rows: [{ external_id: '123' }] } } })
  assert.deepEqual([...await repo.existingExternalIds('tmdb', ['123'])], ['123'])
  assert.deepEqual(queries[0], ['tmdb', ['123']])
})

test('管理列表可以独立筛选动漫，手工资料校验标准字段', async () => {
  const calls = []
  const repository = {
    list: async (...args) => { calls.push(args); return [] },
    createItem: async (item) => item,
  }
  const service = createMediaLibraryService(repository, {}, createPlayableSearch())
  await service.adminList('anime', '测试')
  assert.deepEqual(calls[0], [null, '测试', true, 'anime'])
  const item = await service.createItem({ mediaType: 'tv', title: '动漫', contentCategory: 'anime', genres: ['动画'], releaseDate: '2025-02-01' })
  assert.equal(item.contentCategory, 'anime')
  assert.deepEqual(item.genres, ['动画'])
  await assert.rejects(service.createItem({ mediaType: 'movie', title: '影片', releaseDate: '2025-02-30' }), /上映日期无效/)
})

test('规范化豆瓣榜单并提取电视剧集数', () => {
  const body = { subject_collection_items: [{
    id: '1292052', title: '示例影片', rank: 3, year: '2026', episodes_info: '更新至18集',
    pic: { large: 'https://img.example/poster.jpg' }, rating: { value: 9.1, count: 123 },
    card_subtitle: '2026 / 中国大陆 / 剧情', comment: '简介',
  }] }
  const [item] = normalizeDoubanItems(body, 'tv', 'tv_domestic')
  assert.equal(item.externalId, '1292052')
  assert.equal(item.ranking, 3)
  assert.equal(item.episodeCount, 18)
  assert.equal(item.rating, 9.1)
  assert.equal(item.metadata.ratingCount, 123)
  assert.equal(episodeCountFrom('16集全'), 16)
  assert.equal(episodeCountFrom(''), null)
})

test('分别识别电视剧总集数和当前更新集数', () => {
  assert.deepEqual(episodeProgressFrom('更新至12集', 40), {
    totalEpisodeCount: 40,
    availableEpisodeCount: 12,
    episodeStatus: 'updating',
  })
  assert.deepEqual(episodeProgressFrom('16集全'), {
    totalEpisodeCount: 16,
    availableEpisodeCount: 16,
    episodeStatus: 'completed',
  })
  assert.deepEqual(episodeProgressFrom('', 24), {
    totalEpisodeCount: 24,
    availableEpisodeCount: null,
    episodeStatus: 'unknown',
  })
})

test('豆瓣 Provider 使用结构化榜单接口', async () => {
  let requestedUrl
  const provider = createDoubanProvider({
    fetch: async (url) => {
      requestedUrl = String(url)
      return new Response(JSON.stringify({ subject_collection_items: [{ id: '1', title: '测试电影', rank: 1, rating: { value: 8.8 } }] }), { status: 200 })
    },
  })
  const items = await provider.list('movie', 20)
  assert.match(requestedUrl, /movie_top250\/items/)
  assert.match(requestedUrl, /count=20/)
  assert.equal(items[0].mediaType, 'movie')
})

test('豆瓣 Provider 分五页读取榜单前 250 名并连续补齐排名', async () => {
  const requestedUrls = []
  const provider = createDoubanProvider({
    fetch: async (url) => {
      const parsedUrl = new URL(url)
      requestedUrls.push(parsedUrl)
      const start = Number(parsedUrl.searchParams.get('start'))
      const count = Number(parsedUrl.searchParams.get('count'))
      return new Response(JSON.stringify({ subject_collection_items: Array.from({ length: count }, (_, index) => ({
        id: String(start + index + 1),
        title: `影片${start + index + 1}`,
        rating: { value: 8 },
      })) }))
    },
  })
  const items = await provider.list('movie', 250)
  assert.equal(items.length, 250)
  assert.deepEqual(requestedUrls.map((url) => [url.searchParams.get('start'), url.searchParams.get('count')]), [
    ['0', '50'], ['50', '50'], ['100', '50'], ['150', '50'], ['200', '50'],
  ])
  assert.equal(items[49].ranking, 50)
  assert.equal(items[50].ranking, 51)
  assert.equal(items[249].ranking, 250)
})

test('豆瓣 Provider 遇到单页无效条目时仍继续读取下一页', async () => {
  const starts = []
  const provider = createDoubanProvider({
    fetch: async (url) => {
      const parsedUrl = new URL(url)
      const start = Number(parsedUrl.searchParams.get('start'))
      starts.push(start)
      const items = start === 0
        ? Array.from({ length: 50 }, (_, index) => index === 0 ? { title: '无编号条目' } : { id: String(index + 1), title: `影片${index + 1}` })
        : [{ id: '51', title: '影片51' }]
      return new Response(JSON.stringify({ total: 51, subject_collection_items: items }))
    },
  })
  const items = await provider.list('tv', 100)
  assert.deepEqual(starts, [0, 50])
  assert.equal(items.length, 50)
  assert.equal(items.at(-1).ranking, 51)
})

test('豆瓣名称搜索只保留电影和电视剧', () => {
  const results = normalizeDoubanSearch({ subjects: { items: [
    { target_type: 'tv', target: { id: '25754848', title: '琅琊榜', year: '2015', rating: { value: 9.4 } } },
    { target_type: 'book', target: { id: '2326571', title: '琅琊榜' } },
    { target_type: 'movie', target: { id: '1292052', title: '肖申克的救赎', year: '1994' } },
  ] } })
  assert.deepEqual(results.map((item) => item.mediaType), ['tv', 'movie'])
  assert.equal(results[0].externalId, '25754848')
})

test('豆瓣详情可转换为手工入库数据', () => {
  const item = normalizeDoubanDetail({
    id: '25754848', type: 'tv', title: '琅琊榜', year: '2015', episodes_count: 54,
    intro: '剧情简介', cover_url: 'https://img1.doubanio.com/poster.jpg', rating: { value: 9.4, count: 100 },
  }, 'tv')
  assert.equal(item.episodeCount, 54)
  assert.equal(item.totalEpisodeCount, 54)
  assert.equal(item.availableEpisodeCount, null)
  assert.equal(item.episodeStatus, 'unknown')
  assert.equal(item.summary, '剧情简介')
  assert.equal(item.ranking, null)
})

test('豆瓣 Provider 优先通过移动端搜索并读取正式详情', async () => {
  const requestedUrls = []
  const provider = createDoubanProvider({
    fetch: async (url) => {
      requestedUrls.push(String(url))
      if (String(url).includes('/api/v2/search')) return Response.json({ subjects: { items: [
        { target_type: 'tv', target: { id: '25754848', title: '琅琊榜', year: '2015' } },
        { target_type: 'book', target: { id: '2326571', title: '琅琊榜' } },
      ] } })
      return new Response(JSON.stringify({ id: '25754848', type: 'tv', title: '琅琊榜', year: '2015', episodes_count: 54, rating: { value: 9.4 } }))
    },
  })
  const results = await provider.search('琅琊榜')
  assert.match(requestedUrls[0], /m\.douban\.com\/rexxar\/api\/v2\/search/)
  assert.match(requestedUrls[1], /rexxar\/api\/v2\/movie\/25754848/)
  assert.equal(requestedUrls.length, 2)
  assert.equal(results[0].mediaType, 'tv')
  assert.equal(results[0].rating, 9.4)
})

test('豆瓣移动端搜索受限时回退联想接口，详情不可用仍显示基础信息', async () => {
  const provider = createDoubanProvider({
    fetch: async (url) => {
      if (String(url).includes('/api/v2/search')) return new Response('', { status: 403 })
      if (String(url).includes('subject_suggest')) return Response.json([{ id: '25754848', title: '琅琊榜', type: 'movie', episode: '54' }])
      return new Response('', { status: 503 })
    },
  })
  const results = await provider.search('琅琊榜')
  assert.deepEqual(results.map(({ externalId, mediaType, title }) => ({ externalId, mediaType, title })), [
    { externalId: '25754848', mediaType: 'tv', title: '琅琊榜' },
  ])
})

test('豆瓣移动端受限且联想接口返回空时明确报错', async () => {
  const provider = createDoubanProvider({
    fetch: async (url) => String(url).includes('/api/v2/search')
      ? new Response('', { status: 403 })
      : Response.json([]),
  })
  await assert.rejects(provider.search('测试影片'), /豆瓣搜索返回 403/)
})

test('影视库同步合并并发请求并按类型各读取最多五页', async () => {
  const calls = []
  const repository = {
    list: async () => [],
    get: async () => null,
    listEpisodeSources: async () => [],
    sync: async (type, items) => { calls.push(type); return { inserted: items.length, updated: 0 } },
  }
  const doubanProvider = {
    list: async (type, limit) => { calls.push(`${type}:${limit}`); return [{ externalId: type, mediaType: type }] },
  }
  const service = createMediaLibraryService(repository, doubanProvider, createPlayableSearch())
  const [first, second] = await Promise.all([service.sync(), service.sync()])
  assert.deepEqual(first, second)
  assert.deepEqual(calls.sort(), ['movie', 'movie:250', 'tv', 'tv:250'])
  assert.equal(first.sources.every((source) => source.status === 'success'), true)
})

test('刷新所有豆瓣电视剧的总集数和已更新集数', async () => {
  const updated = []
  const repository = {
    listEpisodeSources: async () => [
      { id: 1, externalId: '36449295' },
      { id: 2, externalId: '25754848' },
    ],
    updateEpisodeProgress: async (item) => { updated.push(item); return item },
  }
  const doubanProvider = {
    get: async (_type, externalId) => ({
      externalId,
      totalEpisodeCount: externalId === '36449295' ? 47 : 54,
      availableEpisodeCount: externalId === '36449295' ? 18 : 54,
      episodeStatus: externalId === '36449295' ? 'updating' : 'completed',
      metadata: { episodesInfo: externalId === '36449295' ? '更新至18集' : '54集全' },
    }),
  }
  const service = createMediaLibraryService(repository, doubanProvider, createPlayableSearch())
  const result = await service.refreshEpisodeProgress()
  assert.deepEqual(result, { count: 2, updated: 2, failed: 0, syncedAt: result.syncedAt })
  assert.equal(updated.length, 2)
  const updating = updated.find((item) => item.externalId === '36449295')
  assert.equal(updating.totalEpisodeCount, 47)
  assert.equal(updating.availableEpisodeCount, 18)
})

test('电视剧可搜索未更新的计划集数，但不能超过总集数', async () => {
  const repository = {
    get: async () => ({
      id: 5,
      mediaType: 'tv',
      title: '兰香如故',
      totalEpisodeCount: 47,
      availableEpisodeCount: 18,
      episodeCount: 18,
    }),
  }
  const searches = []
  const service = createMediaLibraryService(repository, {}, {
    search: async (input) => { searches.push(input); return { results: [] } },
  })
  await service.searchPlayable({ mediaId: 5, episode: 19 })
  assert.equal(searches[0].episode, 19)
  await assert.rejects(
    () => service.searchPlayable({ mediaId: 5, episode: 48 }),
    /集数不能超过 47/,
  )
  assert.equal(searches.length, 1)
})

test('按豆瓣 ID 手工入库并返回新增状态', async () => {
  const repository = {
    importItem: async (item) => ({ item: { id: 41, ...item, addedManually: true }, inserted: true }),
  }
  const doubanProvider = {
    get: async (type, id) => ({ source: 'douban', externalId: id, mediaType: type, title: '琅琊榜' }),
  }
  const service = createMediaLibraryService(repository, doubanProvider, createPlayableSearch())
  const output = await service.importDouban({ mediaType: 'tv', externalId: '25754848' })
  assert.equal(output.inserted, true)
  assert.equal(output.item.externalId, '25754848')
})

test('后台可创建和编辑影视资料并校验电视剧集数', async () => {
  let created
  let updated
  const repository = {
    createItem: async (item) => { created = item; return { id: 61, ...item } },
    get: async () => ({ id: 61 }),
    updateItem: async (id, item) => { updated = { id, ...item }; return updated },
  }
  const service = createMediaLibraryService(repository, {}, createPlayableSearch())
  const item = await service.createItem({
    mediaType: 'tv', title: '测试连载剧', year: 2026, rating: 0,
    totalEpisodeCount: 40, availableEpisodeCount: 18,
  })
  assert.equal(item.id, 61)
  assert.equal(created.source, 'manual')
  assert.match(created.externalId, /^[0-9a-f-]{36}$/)
  assert.equal(created.episodeCount, 18)
  assert.equal(created.episodeStatus, 'updating')

  await service.updateItem(61, {
    mediaType: 'tv', title: '测试完结剧', totalEpisodeCount: 40, availableEpisodeCount: 40,
  })
  assert.equal(updated.episodeStatus, 'completed')
  await assert.rejects(
    () => service.updateItem(61, { mediaType: 'tv', title: '集数错误', totalEpisodeCount: 18, availableEpisodeCount: 19 }),
    /已更新集数不能超过总集数/,
  )
})

test('后台批量删除会去重并限制空选择', async () => {
  let deletedIds
  const repository = {
    deleteItems: async (ids) => { deletedIds = ids; return ids.length },
  }
  const service = createMediaLibraryService(repository, {}, createPlayableSearch())
  assert.deepEqual(await service.deleteItems([2, '2', 3]), { deleted: 2 })
  assert.deepEqual(deletedIds, [2, 3])
  await assert.rejects(() => service.deleteItems([]), /请选择要删除的影视/)
})

test('在线播放搜索只返回有效 HTTP 媒体地址', async () => {
  const search = createPlayableSearch([{
    id: 'authorized', name: '授权来源',
    search: async () => [
      { title: 'HLS', url: 'https://media.example/show.m3u8' },
      { title: 'MP4', url: 'https://media.example/show.mp4' },
      { title: '无效', url: 'javascript:alert(1)' },
    ],
  }], { ttlMs: 1 })
  const output = await search.search({ mediaId: 1, title: '测试剧', episode: 2 })
  assert.equal(output.keyword, '测试剧 第02集')
  assert.deepEqual(output.results.map((item) => item.type), ['hls', 'direct'])
  assert.equal(output.providers[0].count, 2)
})

test('牛牛播放源按影视名称和集数返回对应 HLS', async () => {
  const requests = []
  const provider = createNiuniuProvider({
    fetch: async (url) => {
      requests.push(new URL(url))
      if (String(url).includes('/ajax/suggest')) {
        return Response.json({ list: [
          { id: 10, name: '测试剧特别篇' },
          { id: 11, name: '测试 剧' },
        ] })
      }
      return Response.json({ list: [{
        vod_name: '测试剧',
        vod_year: '2026',
        vod_play_from: 'other$$$nnm3u8',
        vod_play_url: '正片$https://ignored.example/video.mp4$$$第01集$https://media.example/01.m3u8#第02集$https://media.example/02.m3u8',
      }] })
    },
  })
  const results = await provider.search({ title: '测试剧', year: 2026, episode: 2 })
  assert.deepEqual(results, [{ title: '测试剧 · 第02集', url: 'https://media.example/02.m3u8', type: 'hls' }])
  assert.equal(requests.length, 2)
  assert.equal(requests[0].searchParams.get('limit'), '100')
  assert.equal(requests[1].searchParams.get('ids'), '11')
})

test('牛牛播放源拒绝同名不同年份并支持无编号选集回退', () => {
  const record = {
    vod_name: '测试电影',
    vod_year: '2025',
    vod_play_from: 'nnm3u8',
    vod_play_url: '蓝光$https://media.example/a.m3u8#国语$https://media.example/b.m3u8',
  }
  assert.deepEqual(normalizeNiuniuResults([record], { title: '测试电影', year: 2024 }), [])
  assert.deepEqual(normalizeNiuniuResults([record], { title: '测试电影', year: 2025, episode: 2 }), [
    { title: '测试电影 · 国语', url: 'https://media.example/b.m3u8', type: 'hls' },
  ])
})

test('牛牛播放源将上游异常转换为明确错误', async () => {
  const provider = createNiuniuProvider({ fetch: async () => new Response('error', { status: 503 }) })
  await assert.rejects(() => provider.search({ title: '测试剧', episode: 1 }), /牛牛资源搜索返回 503/)
})

test('MacCMS 播放源只返回完全匹配年份和指定线路的直连 HLS', () => {
  const records = [{
    vod_name: '测试 电影',
    vod_year: '2025',
    vod_play_from: 'share$$$bfzym3u8',
    vod_play_url: 'HD$https://share.example/item$$$高清$https://media.example/movie.m3u8#下载$http://media.example/movie.mp4',
  }, {
    vod_name: '测试电影特别篇',
    vod_year: '2025',
    vod_play_from: 'bfzym3u8',
    vod_play_url: '高清$https://media.example/special.m3u8',
  }]
  assert.deepEqual(normalizeMacCmsResults(records, { title: '测试电影', year: 2025 }, ['bfzym3u8']), [
    { title: '测试 电影 · 高清', url: 'https://media.example/movie.m3u8', type: 'hls' },
  ])
  assert.deepEqual(normalizeMacCmsResults(records, { title: '测试电影', year: 2024 }, ['bfzym3u8']), [])
})

test('MacCMS 播放源按集数选择并支持无编号线路回退', () => {
  const records = [{
    vod_name: '测试剧',
    vod_year: '2026',
    vod_play_from: 'xlm3u8',
    vod_play_url: '上集$https://media.example/01.m3u8#下集$https://media.example/02.m3u8',
  }]
  assert.deepEqual(normalizeMacCmsResults(records, { title: '测试剧', year: 2026, episode: 2 }, ['xlm3u8']), [
    { title: '测试剧 · 下集', url: 'https://media.example/02.m3u8', type: 'hls' },
  ])
})

test('MacCMS 已标注集数的线路不会用列表位置冒充缺失集数', () => {
  const records = [{
    vod_name: '测试剧',
    vod_year: '2026',
    vod_play_from: 'xlm3u8',
    vod_play_url: '第01集$https://media.example/01.m3u8#第03集$https://media.example/03.m3u8',
  }]
  assert.deepEqual(normalizeMacCmsResults(records, { title: '测试剧', year: 2026, episode: 2 }, ['xlm3u8']), [])
})

test('牛牛已标注集数的线路不会用列表位置冒充缺失集数', () => {
  const records = [{
    vod_name: '测试剧',
    vod_year: '2026',
    vod_play_from: 'nnm3u8',
    vod_play_url: '第01集$https://media.example/01.m3u8#第03集$https://media.example/03.m3u8',
  }]
  assert.deepEqual(normalizeNiuniuResults(records, { title: '测试剧', year: 2026, episode: 2 }), [])
})

test('标准 MacCMS Provider 使用各自接口与播放标识', async () => {
  const cases = [
    [createBaofengProvider, 'baofeng', '暴风资源', 'bfzym3u8'],
    [createYzy1080Provider, 'yzy1080', '1080影视', '1080zyk'],
    [createXinlangProvider, 'xinlang', '新浪资源', 'xlm3u8'],
    [createFeifanProvider, 'feifan', '非凡资源', 'ffm3u8'],
    [createZy360Provider, 'zy360', '360资源', '360zy'],
  ]
  for (const [factory, id, name, flag] of cases) {
    let requestedUrl
    const provider = factory({
      apiUrl: `https://${id}.example/api.php`,
      fetch: async (url) => {
        requestedUrl = new URL(url)
        return Response.json({ list: [{
          vod_name: '测试剧',
          vod_year: '2026',
          vod_play_from: flag,
          vod_play_url: '第01集$https://media.example/01.m3u8',
        }] })
      },
    })
    const results = await provider.search({ title: '测试剧', year: 2026, episode: 1 })
    assert.equal(provider.id, id)
    assert.equal(provider.name, name)
    assert.equal(requestedUrl.searchParams.get('ac'), 'detail')
    assert.equal(requestedUrl.searchParams.get('wd'), '测试剧')
    assert.deepEqual(results, [{ title: '测试剧 · 第01集', url: 'https://media.example/01.m3u8', type: 'hls' }])
  }
})

test('非凡与360资源只保留同年份的直连 HTTPS HLS，不接受解析页或 HTTP', async () => {
  for (const [factory, flag] of [[createFeifanProvider, 'ffm3u8'], [createZy360Provider, '360zy']]) {
    const provider = factory({
      fetch: async () => Response.json({ list: [{
        vod_name: '测试电影',
        vod_year: '2025',
        vod_play_from: `parser$$$${flag}`,
        vod_play_url: '播放$https://example.com/parse?url=123$$$正片$https://media.example/movie.m3u8#备份$http://media.example/movie.m3u8#解析$https://example.com/parse?url=123',
      }] }),
    })
    assert.deepEqual(await provider.search({ title: '测试电影', year: 2024 }), [])
    assert.deepEqual(await provider.search({ title: '测试电影', year: 2025 }), [
      { title: '测试电影 · 正片', url: 'https://media.example/movie.m3u8', type: 'hls' },
    ])
  }
})

test('MacCMS 播放源将上游异常转换为来源明确的错误', async () => {
  const provider = createBaofengProvider({ fetch: async () => new Response('error', { status: 503 }) })
  await assert.rejects(() => provider.search({ title: '测试剧' }), /暴风资源搜索返回 503/)
})

test('海报代理仅请求豆瓣图片域名并附带来源页', async () => {
  let requestOptions
  const proxy = createPosterProxy({
    fetch: async (_url, options) => {
      requestOptions = options
      return new Response(Buffer.from('image'), { headers: { 'content-type': 'image/jpeg' } })
    },
  })
  const poster = await proxy.fetch('https://img3.doubanio.com/view/photo/poster.jpg')
  assert.equal(poster.contentType, 'image/jpeg')
  assert.equal(poster.body.toString(), 'image')
  assert.equal(requestOptions.headers.referer, 'https://movie.douban.com/')
  await assert.rejects(() => proxy.fetch('https://example.com/poster.jpg'), /海报来源不受支持/)
})

test('海报代理拒绝可执行图片类型和超大响应', async () => {
  const svgProxy = createPosterProxy({ fetch: async () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }) })
  await assert.rejects(() => svgProxy.fetch('https://img1.doubanio.com/poster.svg'), /未返回受支持的图片/)
  const largeProxy = createPosterProxy({ fetch: async () => new Response('x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(6 * 1024 * 1024) } }) })
  await assert.rejects(() => largeProxy.fetch('https://img1.doubanio.com/poster.jpg'), /海报文件过大/)
})
