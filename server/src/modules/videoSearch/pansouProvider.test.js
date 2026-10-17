import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { createVideoSearchRouter } from './index.js'
import { createPanSouProvider, isAllowedPanLink } from './pansouProvider.js'
import { createResolveToken, readResolveToken } from './token.js'

const shareUrl = 'https://www.guangyapan.com/s/example'
const sse = (text) => new Response(text, { headers: { 'content-type': 'text/event-stream;charset=UTF-8' } })
const done = (url = shareUrl) => sse(`data: ${JSON.stringify({ type: 'done', data: { url } })}\n\ndata: [DONE]\n\n`)

test('查询源站当前启用的五种网盘并保留来源线路和分享凭证', async () => {
  const types = []
  const provider = createPanSouProvider({
    fetch: async (url) => {
      assert.equal(url.pathname, '/api/other/web_search')
      assert.equal(url.searchParams.get('title'), '三体')
      const type = Number(url.searchParams.get('is_type'))
      types.push(type)
      return sse(`线路：TG爬虫\n\n线路：光鸭\n\ndata: ${JSON.stringify({ title: '三体', url: `token-${type}`, is_type: type, stoken: 'share-access-token' })}\n\ndata: [DONE]\n\n`)
    },
  })
  const output = await provider.search('三体')
  assert.deepEqual(types.sort((a, b) => a - b), [0, 2, 3, 4, 10])
  assert.equal(output.status, 'success')
  assert.equal(output.results.length, 5)
  assert.equal(output.results.find((item) => item.storageType === 'guangya').stoken, 'share-access-token')
  assert.ok(output.results.every((item) => item.sourceLine === '光鸭'))
})

test('搜索流跨 UTF-8 分片、CRLF 和无末尾换行时仍完整读取并先去重后限量', async () => {
  const bytes = new TextEncoder().encode('线路：广播剧\r\ndata: {"title":"三体 [DONE] 合集","url":"one"}\r\ndata: {"title":"重复","url":"one"}\r\ndata: malformed\r\ndata: {"title":{},"url":"invalid"}\r\ndata: {"data":{"title":"三体全集","url":"two","source":"手动上传"}}')
  const provider = createPanSouProvider({
    maxResults: 2,
    fetch: async () => new Response(new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
        controller.close()
      },
    }), { headers: { 'content-type': 'text/event-stream' } }),
  })
  const output = await provider.search('三体')
  assert.equal(output.results.length, 10)
  assert.equal(output.results[0].title, '三体 [DONE] 合集')
  assert.equal(output.results[0].sourceLine, '广播剧')
  assert.equal(output.results[1].sourceLine, '手动上传')
})

test('收到搜索 DONE 或达到上限时取消底层流', async () => {
  for (const maxResults of [1, 2]) {
    let cancelled = 0
    const provider = createPanSouProvider({
      maxResults,
      fetch: async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('data: {"title":"三体","url":"token"}\n\ndata: [DONE]\n\n')) },
        cancel() { cancelled += 1 },
      }), { headers: { 'content-type': 'text/event-stream' } }),
    })
    assert.equal((await provider.search('三体')).results.length, 5)
    assert.equal(cancelled, 5)
  }
})

test('单线路失败不影响其余结果，全部失效和 HTML 错误页不会伪装成成功', async () => {
  const provider = createPanSouProvider({ fetch: async (url) => url.searchParams.get('is_type') === '10'
    ? new Response('unavailable', { status: 503 })
    : sse('data: {"title":"三体","url":"token"}\n\ndata: [DONE]\n\n') })
  const output = await provider.search('三体')
  assert.equal(output.status, 'partial')
  assert.equal(output.results.length, 4)
  assert.match(output.message, /1 条/)
  await assert.rejects(createPanSouProvider({ fetch: async () => new Response('<html>error</html>') }).search('三体'), /暂时无法访问/)
})

test('流式解析忽略进度并传递 URL 编码和 stoken，成功后取消流', async () => {
  let requests = 0
  let cancelled = false
  const provider = createPanSouProvider({ fetch: async (url, options) => {
    requests += 1
    assert.equal(url.pathname, '/api/other/save_url_stream')
    assert.equal(options.headers.accept, 'text/event-stream')
    assert.deepEqual(JSON.parse(options.body), { url: '%2Fopaque%2B%3D%25', title: '三体', stoken: 'access-token' })
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`data: {"type":"progress","message":"正在转存","percent":35}\n\ndata: ${JSON.stringify({ type: 'done', data: { url: shareUrl } })}\n\n`)) },
      cancel() { cancelled = true },
    }), { headers: { 'content-type': 'text/event-stream' } })
  } })
  assert.equal(await provider.resolve('/opaque+=%', '三体', 'access-token'), shareUrl)
  assert.equal(requests, 1)
  assert.equal(cancelled, true)
})

test('解析 done 事件无末尾换行时仍可获取链接', async () => {
  const provider = createPanSouProvider({ fetch: async () => sse(`data: ${JSON.stringify({ type: 'done', data: { url: shareUrl } })}`) })
  assert.equal(await provider.resolve('token', '三体'), shareUrl)
})

test('旧站不支持流式接口、非 SSE 或未完成流时只回退一次 JSON 解析', async () => {
  for (const responseFactory of [
    () => new Response('not found', { status: 404 }),
    () => new Response('method not allowed', { status: 405 }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => sse('data: {"type":"progress","percent":10}\n\ndata: [DONE]\n\n'),
    () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('disconnected')) } }), { headers: { 'content-type': 'text/event-stream' } }),
  ]) {
    const paths = []
    const provider = createPanSouProvider({ fetch: async (url) => {
      paths.push(url.pathname)
      return paths.length === 1 ? responseFactory() : new Response(JSON.stringify({ code: 200, data: { url: shareUrl } }))
    } })
    assert.equal(await provider.resolve('token', '三体'), shareUrl)
    assert.deepEqual(paths, ['/api/other/save_url_stream', '/api/other/save_url'])
  }
})

test('源站明确解析失败、不可信地址、缺失链接或限流时不重复转存', async () => {
  for (const [responseFactory, message] of [
    [() => sse('data: {"type":"error","message":"分享内容为空或获取失败"}\n\n'), /分享内容为空/],
    [() => done('https://www.guangyapan.com.evil.test/s/example'), /不受信任/],
    [() => sse('data: {"type":"done","data":{}}\n\n'), /未返回有效/],
    [() => new Response('limited', { status: 429 }), /429/],
  ]) {
    let requests = 0
    const provider = createPanSouProvider({ fetch: async () => { requests += 1; return responseFactory() } })
    await assert.rejects(provider.resolve('token', '三体'), message)
    assert.equal(requests, 1)
  }
})

test('解析超时返回 504 且不启动回退请求', async () => {
  let requests = 0
  const provider = createPanSouProvider({ fetch: async () => { requests += 1; throw new DOMException('timeout', 'TimeoutError') } })
  await assert.rejects(provider.resolve('token', '三体'), (error) => error.status === 504 && /超过/.test(error.message))
  assert.equal(requests, 1)
})

test('缓存 TTL 为零时每次重新解析，仍合并同一分享凭证的并发请求', async () => {
  let requests = 0
  const provider = createPanSouProvider({ resolveCacheTtlMs: 0, fetch: async () => {
    requests += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return done()
  } })
  await Promise.all([provider.resolve('token', '三体', 'a'), provider.resolve('token', '三体', 'a')])
  assert.equal(requests, 1)
  await provider.resolve('token', '三体', 'a')
  assert.equal(requests, 2)
})

test('可选缓存按分享访问凭证隔离，失败的并发解析可再次重试', async () => {
  let requests = 0
  const provider = createPanSouProvider({ resolveCacheTtlMs: 300000, fetch: async () => { requests += 1; return done() } })
  await provider.resolve('token', '三体', 'a')
  await provider.resolve('token', '三体', 'a')
  await provider.resolve('token', '三体', 'b')
  assert.equal(requests, 2)
  let attempts = 0
  const retryProvider = createPanSouProvider({ fetch: async () => ++attempts === 1 ? sse('data: {"type":"error","message":"失败"}\n\n') : done() })
  await assert.rejects(retryProvider.resolve('token', '三体'), /失败/)
  assert.equal(await retryProvider.resolve('token', '三体'), shareUrl)
  assert.equal(attempts, 2)
})

test('只放行实测光鸭 HTTPS 分享域名且拒绝相似域名', () => {
  assert.equal(isAllowedPanLink(shareUrl), true)
  for (const url of ['http://www.guangyapan.com/s/example', 'https://www.guangyapan.com.evil.test/s/example', 'https://www.guangyapan.com@evil.test/s/example', 'https://evil.test/?next=https://www.guangyapan.com']) {
    assert.equal(isAllowedPanLink(url), false)
  }
})

test('搜索与解析 API 将 stoken 纳入签名凭证并兼容旧凭证', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.session = { user: { id: 1 } }; next() })
  let resolveBody
  app.use('/api/video-search', createVideoSearchRouter({
    tokenSecret: 'test-secret', requireAuth,
    providerOptions: { fetch: async (url, options) => {
      if (url.pathname === '/api/other/web_search') return url.searchParams.get('is_type') === '10'
        ? sse('线路：光鸭\n\ndata: {"title":"三体","url":"opaque","stoken":"access-token","is_type":10}\n\ndata: [DONE]\n\n')
        : sse('data: [DONE]\n\n')
      resolveBody = JSON.parse(options.body)
      return done()
    } },
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/video-search`
  const search = await fetch(`${base}/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"keyword":"三体"}' })
  const { results } = await search.json()
  assert.equal(results.length, 1)
  assert.equal(results[0].storageType, 'guangya')
  assert.equal(results[0].rawToken, undefined)
  assert.equal(results[0].stoken, undefined)
  const payload = readResolveToken(results[0].resolveToken, 'test-secret')
  assert.equal(payload.stoken, 'access-token')
  const resolved = await fetch(`${base}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolveToken: results[0].resolveToken }) })
  assert.equal(resolved.status, 200)
  assert.deepEqual(await resolved.json(), { url: shareUrl })
  assert.equal(resolveBody.stoken, 'access-token')
  const legacyToken = createResolveToken({ provider: 'tiancha', rawToken: 'opaque', title: '三体' }, 'test-secret')
  const legacy = await fetch(`${base}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolveToken: legacyToken }) })
  assert.equal(legacy.status, 200)
  assert.equal(resolveBody.stoken, '')
})
