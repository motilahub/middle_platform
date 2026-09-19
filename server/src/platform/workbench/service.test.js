import assert from 'node:assert/strict'
import test from 'node:test'
import { mapApp } from '../../shared/mappers.js'
import { createWorkbenchService } from './service.js'

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
