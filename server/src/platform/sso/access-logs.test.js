import assert from 'node:assert/strict'
import test from 'node:test'
import { createSsoService } from './service.js'

test('access logs pass pagination through and retain zero-millisecond durations', async () => {
  let input
  const service = createSsoService({
    async listAccessLogs(params) {
      input = params
      return {
        total: 42,
        rows: [{ id: '21', method: 'GET', path: '/api/me', status_code: 200, duration_ms: 0, created_at: '2026-09-29T08:00:00.000Z' }],
      }
    },
  })

  const result = await service.listAccessLogs({ page: '2', pageSize: '20', method: 'get' })
  assert.deepEqual(input, { keyword: '', method: 'GET', status: null, page: 2, pageSize: 20 })
  assert.equal(result.total, 42)
  assert.equal(result.rows[0].durationMs, 0)
})
