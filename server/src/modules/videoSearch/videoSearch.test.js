import assert from 'node:assert/strict'
import test from 'node:test'
import { createModule, manifest } from './index.js'
import { createPanSouProvider, isAllowedPanLink, parsePanSouDataLine } from './pansouProvider.js'
import { createResolveToken, readResolveToken } from './token.js'

test('天影查通过业务模块契约注册公开接口并迁移入口', async () => {
  const uses = []
  let migrationSql = ''
  const module = createModule({ sessionSecret: 'test-secret' })
  module.register({ use: (...args) => uses.push(args) })
  await module.migrate({ pool: { query: async (sql) => { migrationSql = sql } } })
  assert.equal(manifest.key, 'video-search')
  assert.equal(uses[0][0], '/api/video-search')
  assert.equal(uses[0].length, 2)
  assert.notEqual(uses[0][1], 'require-auth')
  assert.match(migrationSql, /dashboard_apps/)
  assert.match(migrationSql, /天影查/)
})

test('解析天查 SSE 数据行', () => {
  assert.deepEqual(parsePanSouDataLine('data: {"title":"兰香如故","url":"opaque","is_type":2}'), { title: '兰香如故', url: 'opaque', is_type: 2 })
  assert.equal(parsePanSouDataLine('data: [DONE]'), null)
  assert.equal(parsePanSouDataLine('线路：百度'), null)
})

test('签名链接凭证可校验且会过期', () => {
  const secret = 'test-secret'
  const token = createResolveToken({ provider: 'tiancha', rawToken: 'opaque', title: '兰香' }, secret, 1000)
  assert.equal(readResolveToken(token, secret, 2000).rawToken, 'opaque')
  assert.throws(() => readResolveToken(token, secret, 301001), /过期/)
  assert.throws(() => readResolveToken(`${token}x`, secret, 2000), /无效/)
})

test('只允许受支持的 HTTPS 网盘地址', () => {
  assert.equal(isAllowedPanLink('https://pan.baidu.com/s/example'), true)
  assert.equal(isAllowedPanLink('https://pan.quark.cn/s/example'), true)
  assert.equal(isAllowedPanLink('http://pan.baidu.com/s/example'), false)
  assert.equal(isAllowedPanLink('https://example.com/?next=https://pan.baidu.com'), false)
})

test('按需解析链接并校验返回域名', async () => {
  let requestBody
  const provider = createPanSouProvider({
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return new Response(JSON.stringify({ code: 200, data: { url: 'https://pan.baidu.com/s/example?pwd=1234' } }), { status: 200 })
    },
  })
  assert.equal(await provider.resolve('opaque-token', '兰香'), 'https://pan.baidu.com/s/example?pwd=1234')
  assert.deepEqual(requestBody, { url: 'opaque-token', title: '兰香' })

  const unsafeProvider = createPanSouProvider({
    fetch: async () => new Response(JSON.stringify({ code: 200, data: { url: 'https://example.com/file' } }), { status: 200 }),
  })
  await assert.rejects(() => unsafeProvider.resolve('opaque-token', '兰香'), /不受信任/)
})

test('每种网盘默认独立读取最多 100 条搜索结果', async () => {
  const stream = Array.from({ length: 120 }, (_, index) => `data: ${JSON.stringify({ title: `小-${index + 1}`, url: `token-${index + 1}` })}\n`).join('') + 'data: [DONE]\n'
  const provider = createPanSouProvider({
    fetch: async () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  })
  const output = await provider.search('小')
  assert.equal(output.results.length, 100 * 4)
  assert.equal(output.results.filter((item) => item.storageType === 'quark').length, 100)
})

test('短时间内复用已解析链接并合并并发请求', async () => {
  let requests = 0
  const provider = createPanSouProvider({
    resolveCacheTtlMs: 300000,
    fetch: async () => {
      requests += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response(JSON.stringify({ code: 200, data: { url: 'https://pan.quark.cn/s/example' } }), { status: 200 })
    },
  })
  const [first, second] = await Promise.all([
    provider.resolve('shared-token', '小'),
    provider.resolve('shared-token', '小'),
  ])
  assert.equal(first, 'https://pan.quark.cn/s/example')
  assert.equal(second, first)
  assert.equal(await provider.resolve('shared-token', '小'), first)
  assert.equal(requests, 1)
})
