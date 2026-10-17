import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { createModule, manifest } from './index.js'
import { createPanSouProvider } from './pansouProvider.js'

test('天影查通过业务模块契约注册需登录的接口并迁移入口', async () => {
  const uses = []
  let migrationSql = ''
  const module = createModule({ sessionSecret: 'test-secret', requireAuth })
  module.register({ use: (...args) => uses.push(args) })
  await module.migrate({ pool: { query: async (sql) => { migrationSql = sql } } })
  assert.equal(manifest.key, 'video-search')
  assert.equal(uses[0][0], '/api/video-search')
  assert.equal(uses[0].length, 2)
  assert.match(migrationSql, /dashboard_apps/)
  assert.match(migrationSql, /天影查/)
})

test('天影查搜索和解析允许匿名请求', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.session = { user: req.get('x-test-user') ? { id: 1 } : null }; next() })
  createModule({ sessionSecret: 'test-secret', requireAuth }).register(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/video-search`
  for (const path of ['/search', '/resolve']) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    assert.notEqual(response.status, 401)
  }
  const signedIn = await fetch(`${base}/search`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': '1' }, body: '{}' })
  assert.equal(signedIn.status, 400)
})

test('PanSou Provider 支持结果直达和兼容 resolve 接口', async () => {
  const provider = createPanSouProvider()
  assert.equal(await provider.resolve('https://pan.baidu.com/s/example'), 'https://pan.baidu.com/s/example')
  await assert.rejects(() => provider.resolve('https://example.com/file'), /无效/)
})

test('搜索 API 返回 PanSou 的直达链接', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.session = { user: null }; next() })
  createModule({
    sessionSecret: 'test-secret', requireAuth,
    settingsModule: { service: { panSearchUrl: async () => 'http://localhost:8889/api/search' } },
    providerOptions: { fetch: async () => new Response(JSON.stringify({ code: 0, data: { merged_by_type: { quark: [{ url: 'https://pan.quark.cn/s/example', note: '三体' }] } } })) },
  }).register(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/video-search/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyword: '三体' }) })
  const result = (await response.json()).results[0]
  assert.equal(result.url, 'https://pan.quark.cn/s/example')
  assert.equal(result.resolveToken, undefined)
})
