import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOutboundIdentity, buildTicketRedirect, createTicket, hashTicket } from './ticket.js'

test('ticket redirect preserves query parameters and appends SSO values', () => {
  const redirectUrl = new URL(buildTicketRedirect('http://localhost:9100/sso/login?from=portal', 'mock_target', 'one-time-ticket'))
  assert.equal(redirectUrl.searchParams.get('from'), 'portal')
  assert.equal(redirectUrl.searchParams.get('ssoCode'), 'mock_target')
  assert.equal(redirectUrl.searchParams.get('ticket'), 'one-time-ticket')
})

test('issued tickets are random and only their digest is stored', () => {
  const first = createTicket()
  const second = createTicket()
  assert.notEqual(first, second)
  assert.match(hashTicket(first), /^[a-f0-9]{64}$/)
  assert.notEqual(hashTicket(first), first)
})

test('outbound identity supports a nested identifier field', () => {
  const identity = buildOutboundIdentity({ code: 'admin', name: 'Admin', uuid: 'uuid', role: 'super_admin' }, 'data.userId')
  assert.equal(identity.data.userId, 'admin')
  assert.equal(identity.userCode, 'admin')
})

test('outbound identity rejects unsafe paths', () => {
  assert.throws(() => buildOutboundIdentity({ code: 'admin' }, '__proto__.userId'), /安全路径/)
})
