import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createAuthService } from './auth-service.js'

function harness() {
  const codes = new Map()
  const mails = []
  const events = []
  const key = 'test-only-hmac-key'
  const hash = (input) => crypto.createHmac('sha256', key).update(input).digest('hex')
  const settings = { registration_enabled: true, smtp_host: 'smtp.example.com', smtp_port: 465, smtp_secure: true, smtp_user: 'user', smtp_password_encrypted: 'encrypted', sender_email: 'no-reply@example.com' }
  const repository = {
    settings: async () => settings,
    limit: async () => true,
    findByEmail: async (email) => email === 'known@example.com' ? { id: 4 } : null,
    issue: async (purpose, addressHash, codeHash) => { codes.set(`${purpose}:${addressHash}`, { codeHash, attempts: 0, expires: Date.now() + 300000 }); return true },
    invalidate: async (purpose, addressHash, codeHash) => { const identity = `${purpose}:${addressHash}`; if (codes.get(identity)?.codeHash === codeHash) codes.delete(identity) },
    consume: async (purpose, addressHash, codeHash, callback) => {
      const identity = `${purpose}:${addressHash}`
      const stored = codes.get(identity)
      if (!stored || stored.attempts >= 3 || stored.expires <= Date.now()) return false
      if (stored.codeHash !== codeHash) { stored.attempts++; return false }
      await callback({ query: async (sql) => sql.includes('INSERT INTO users') ? { rows: [{ id: 42 }] } : { rowCount: 1 } })
      codes.delete(identity)
      return true
    },
    event: async (...args) => { events.push(args) },
  }
  const mailer = { createTransport: () => ({ sendMail: async (mail) => { mails.push(mail) }, close() {} }) }
  const service = createAuthService(repository, { securityPolicy: { validatePassword: (value) => value }, secret: key, cipher: { decrypt: () => 'password' }, mailer })
  const context = { ip: '127.0.0.1' }
  const code = () => mails.at(-1).text.match(/验证码：(\d{6})/)[1]
  return { service, settings, repository, codes, mails, events, context, code, hash }
}

test('new code invalidates the previous code and cannot be reused', async () => {
  const h = harness()
  await h.service.sendCode('register', 'new@example.com', h.context)
  const old = h.code()
  await h.service.sendCode('register', 'new@example.com', h.context)
  const next = h.code()
  const fields = { name: 'New user', login: 'new_user', email: 'new@example.com', password: 'secret123', code: old }
  if (next !== old) await assert.rejects(h.service.register(fields, h.context), /验证码无效/)
  await h.service.register({ ...fields, code: next }, h.context)
  await assert.rejects(h.service.register({ ...fields, code: next }, h.context), /验证码无效/)
  assert.equal(h.events.some(([action, outcome]) => action === 'register' && outcome === 'success'), true)
  assert.equal(h.mails[0].text.includes('secret123'), false)
})

test('three invalid attempts exhaust the current code', async () => {
  const h = harness()
  await h.service.sendCode('reset', 'known@example.com', h.context)
  const real = h.code()
  const invalid = real === '000000' ? '999999' : '000000'
  for (let index = 0; index < 3; index++) await assert.rejects(h.service.reset({ email: 'known@example.com', code: invalid, password: 'secret123' }, h.context), /验证码无效/)
  await assert.rejects(h.service.reset({ email: 'known@example.com', code: real, password: 'secret123' }, h.context), /验证码无效/)
})

test('reset updates password and invalidates sessions without exposing unknown accounts', async () => {
  const h = harness()
  let updated = false
  h.repository.findByEmail = async (email) => email === 'known@example.com' ? { id: 4 } : null
  h.repository.consume = async (_purpose, _hash, _code, callback) => { await callback({ query: async (sql) => { updated = sql.includes('session_version=session_version+1'); return { rowCount: 1 } } }); return true }
  await h.service.sendCode('reset', 'unknown@example.com', h.context)
  assert.equal(h.mails.length, 0)
  await h.service.sendCode('reset', 'known@example.com', h.context)
  await h.service.reset({ email: 'known@example.com', code: h.code(), password: 'secret123' }, h.context)
  assert.equal(updated, true)
})

test('per-identity login limits and audit never store a raw login', async () => {
  const h = harness()
  h.repository.limit = async (action) => action !== 'login_account'
  await assert.rejects(h.service.limitLogin('private@example.com', '127.0.0.1'), (error) => error.status === 429)
  assert.equal(h.events[0][0], 'login')
  assert.equal(h.events[0][2], h.hash('private@example.com'))
  assert.equal(h.events[0][2].includes('private@'), false)
})
