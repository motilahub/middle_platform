import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createAuthService } from './auth-service.js'
import { createAuthRepository } from './auth-repository.js'
import { createIdentityController } from './controller.js'
import { createIdentityRepository } from './repository.js'
import { createIdentityService } from './service.js'

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

test('login limits keep hashed subjects and record bounded login details', async () => {
  const h = harness()
  h.repository.limit = async (action) => action !== 'login_account'
  await assert.rejects(h.service.limitLogin('private@example.com', '127.0.0.1', 'Example Browser'), (error) => error.status === 429)
  assert.equal(h.events[0][0], 'login')
  assert.equal(h.events[0][2], h.hash('private@example.com'))
  assert.equal(h.events[0][2].includes('private@'), false)
  assert.deepEqual(h.events[0].slice(4), ['127.0.0.1', 'private@example.com', 'Example Browser'])
  await h.service.audit('login', 'failed', '  unknown\n@example.com  ', { ip: '::1', userAgent: 'Test\r\nBrowser' })
  assert.deepEqual(h.events[1].slice(4), ['::1', 'unknown@example.com', 'TestBrowser'])
  await h.service.audit('register', 'failed', 'private@example.com', { ip: '::1', userAgent: 'Example Browser' })
  assert.deepEqual(h.events[2].slice(5), [null, null])
})

test('login controller audits failed attempts with request IP and client', async () => {
  const audits = []
  const req = { body: { code: 'missing@example.com', password: 'wrong' }, ip: '192.0.2.5', get: () => 'Example Browser' }
  const controller = createIdentityController({ authenticate: async () => { throw Object.assign(new Error('账号或密码错误'), { status: 401 }) } }, {}, {
    limitLogin: async (...args) => { assert.deepEqual(args, ['missing@example.com', '192.0.2.5', 'Example Browser']) },
    audit: async (...args) => { audits.push(args) },
  })
  await assert.rejects(controller.login(req, {}), (error) => error.status === 401)
  assert.deepEqual(audits, [['login', 'failed', 'missing@example.com', { ip: '192.0.2.5', userAgent: 'Example Browser' }]])
})

test('login event storage and search include attempted identifiers', async () => {
  const queries = []
  const repository = createAuthRepository({ query: async (sql, params) => {
    queries.push({ sql, params })
    if (sql.includes('count(*)')) return { rows: [{ total: 1 }] }
    return { rows: [] }
  } })
  await repository.event('login', 'failed', 'digest', null, '192.0.2.5', 'missing@example.com', 'Example Browser')
  assert.match(queries[0].sql, /login_identifier,user_agent/)
  assert.deepEqual(queries[0].params, ['login', 'failed', 'digest', null, '192.0.2.5', 'missing@example.com', 'Example Browser'])
  await repository.events({ page: 1, pageSize: 20, action: 'login', keyword: 'missing@example.com' })
  assert.match(queries[1].sql, /e\.login_identifier ILIKE/)
  assert.match(queries[2].sql, /e\.login_identifier,e\.user_agent/)
  assert.deepEqual(queries[2].params, ['login', '%missing@example.com%', 20, 0])
})

test('password login accepts an account or a case-insensitive bound email', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4)
  const users = [
    { id: 1, code: 'admin', email: 'admin@example.com', password_hash: passwordHash },
    { id: 2, code: 'admin@example.com', email: 'other@example.com', password_hash: passwordHash },
  ]
  const pool = { query: async (sql, [identifier]) => {
    assert.match(sql, /WHERE code=\$1 OR lower\(email\)=lower\(\$1\)/)
    assert.match(sql, /ORDER BY \(code=\$1\) DESC LIMIT 1/)
    const account = users.find((user) => user.code === identifier)
    const email = users.find((user) => user.email?.toLowerCase() === identifier.toLowerCase())
    return { rows: [account || email].filter(Boolean) }
  } }
  const service = createIdentityService(createIdentityRepository(pool), (user) => user, {}, { enrich: (user) => user })
  assert.equal((await service.authenticate('admin', 'correct-password')).id, 1)
  assert.equal((await service.authenticate(' ADMIN@EXAMPLE.COM ', 'correct-password')).id, 1)
  assert.equal((await service.authenticate('admin@example.com', 'correct-password')).id, 2)
  assert.equal((await service.authenticate('OTHER@EXAMPLE.COM', 'correct-password')).id, 2)
  await assert.rejects(service.authenticate('admin', 'wrong-password'), (error) => error.status === 401 && error.message === '账号或密码错误')
  await assert.rejects(service.authenticate('missing@example.com', 'correct-password'), (error) => error.status === 401 && error.message === '账号或密码错误')
})
