import test from 'node:test'
import assert from 'node:assert/strict'
import { createPermissionMiddleware, requireAuth } from '../../middleware/auth.js'
import { createPermissionService } from './permissions.js'

test('super admin bypasses permission checks and regular users use assigned permissions', () => {
  const service = createPermissionService({ query: async () => ({ rows: [] }) })
  assert.equal(service.has({ role: 'super_admin' }, 'platform.user.unlink'), true)
  assert.equal(service.has({ role: 'user', permissions: ['platform.user.read'] }, 'platform.user.read'), true)
  assert.equal(service.has({ role: 'user', permissions: ['platform.user.read'] }, 'platform.user.unlink'), false)
})

test('permission middleware returns 401 and 403 before calling next', async () => {
  const service = { has: () => false }
  const middleware = createPermissionMiddleware(service)('platform.user.read')
  const response = (status) => ({ statusCode: status, status(value) { this.statusCode = value; return this }, json(body) { this.body = body; return this } })
  const unauthenticated = response(200)
  middleware({ session: {} }, unauthenticated, () => assert.fail('should not call next'))
  assert.equal(unauthenticated.statusCode, 401)
  const forbidden = response(200)
  middleware({ session: { user: { role: 'user', permissions: [] } } }, forbidden, () => assert.fail('should not call next'))
  assert.equal(forbidden.statusCode, 403)
})

test('legacy admin sessions remain compatible until they refresh', () => {
  const service = createPermissionService({ query: async () => ({ rows: [] }) })
  assert.equal(service.has({ role: 'admin' }, 'platform.settings.write'), true)
  assert.equal(service.has({ role: 'admin', permissions: [] }, 'platform.settings.write'), false)
  assert.equal(typeof requireAuth, 'function')
})
