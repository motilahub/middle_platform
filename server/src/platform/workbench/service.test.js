import assert from 'node:assert/strict'
import test from 'node:test'
import { mapApp } from '../../shared/mappers.js'
import { createWorkbenchService } from './service.js'
import { createWorkbenchRepository } from './repository.js'
import { registerWorkbenchRoutes } from './routes.js'
import { requireAuth } from '../../middleware/auth.js'
import { asyncRoute } from '../../middleware/http.js'
import express from 'express'

function serviceWith(repository) {
  return createWorkbenchService(repository, mapApp, {
    persist: async () => ({ original: null, thumbnail: null, filename: null }),
    remove: async () => {},
  }, {
    resolveOutboundConfigId: async () => null,
  })
}

test('工作台应用打开方式默认当前页并可配置新页签', async () => {
  const saved = []
  const service = serviceWith({
    create: async (values) => { saved.push(values); return saved.length },
  })
  await service.create({ code: 'current_app', name: '当前页应用', priority: 1, url: '/current', enabled: true })
  await service.create({ code: 'tab_app', name: '新页签应用', priority: 2, url: '/tab', enabled: true, openMode: 'new_tab' })
  assert.equal(saved[0].at(-1), 'current')
  assert.equal(saved[1].at(-1), 'new_tab')
})

test('工作台应用映射兼容迁移前数据', () => {
  assert.equal(mapApp({ id: 1, code: 'old', name: '旧应用', priority: 1, url: '/', enabled: true, user_ids: [] }).openMode, 'current')
  assert.equal(mapApp({ id: 2, code: 'tab', name: '新页签', priority: 2, url: '/', enabled: true, open_mode: 'new_tab', user_ids: [] }).openMode, 'new_tab')
})

test('工作台公共应用仅登录可见，私有应用只允许管理员角色', async (t) => {
  let sql
  const repository = createWorkbenchRepository({ query: async (query, params) => {
    sql = query
    assert.deepEqual(params, [1])
    return { rows: [] }
  } })
  await repository.listVisible(1)
  assert.match(sql, /\$1::bigint IS NOT NULL/)
  assert.match(sql, /u\.role IN \('admin','super_admin'\)/)
  assert.doesNotMatch(sql, /ANY\(array_agg\(au\.user_id\)\)/)

  const app = express()
  app.use((req, _res, next) => { req.session = { user: req.get('x-test-user') ? { id: 1 } : null }; next() })
  registerWorkbenchRoutes(app, { visible: (_req, res) => res.json([]) }, { asyncRoute, requireAuth, requirePermission: () => (_req, _res, next) => next() })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/api/workbench/apps`
  assert.equal((await fetch(url)).status, 401)
  assert.equal((await fetch(url, { headers: { 'x-test-user': '1' } })).status, 200)
})

test('工作台配置不再依赖指定用户关联，保留历史数据', async () => {
  let userIds
  const service = serviceWith({ create: async (_values, ids) => { userIds = ids; return 1 } })
  await service.create({ code: 'private_app', name: '私有应用', priority: 1, url: '/private', enabled: true, visibility: 'private', userIds: [42] })
  assert.equal(userIds, undefined)
  const repository = createWorkbenchRepository({})
  const operations = []
  await repository.saveUsers({ query: async (sql) => operations.push(sql) }, 1, undefined)
  assert.deepEqual(operations, [])
})
