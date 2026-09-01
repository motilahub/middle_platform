import bcrypt from 'bcryptjs'
import { mapSsoConfig } from './repository.js'
import { buildOutboundIdentity, buildTicketRedirect, createTicket, hashTicket, isSafeIdentityPath } from './ticket.js'

const protocols = new Set(['oidc', 'cas', 'ticket', 'saml'])
const failure = (message, status = 400) => Object.assign(new Error(message), { status })
const readIdentityField = (identity, fieldName) => String(fieldName || 'userId').split('.').reduce((value, key) => value && typeof value === 'object' ? value[key] : undefined, identity)

function integer(value, label, min, max) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw failure(`${label}必须是 ${min}-${max} 之间的整数`)
  return number
}

function validateConfig(body, direction) {
  if (!body.code || !body.name || !body.systemUrl || !protocols.has(body.protocol)) throw failure('请完整填写单点登录基础信息')
  let systemUrl
  try { systemUrl = new URL(body.systemUrl) } catch { throw failure('系统地址必须是有效 URL') }
  if (!['http:', 'https:'].includes(systemUrl.protocol)) throw failure('系统地址必须使用 HTTP(S) 协议')
  if (direction === 'inbound' && body.protocol === 'ticket' && !body.verifyUrl) throw failure('外部访入的 Ticket 协议必须填写校验地址')
  if (direction === 'outbound' && body.protocol === 'ticket') integer(body.ticketTtlSeconds ?? 30, 'Ticket 有效期', 5, 300)
  if (direction === 'outbound' && body.protocol === 'ticket' && !isSafeIdentityPath(body.userIdentifier || 'userId')) throw failure('返回用户标识字段必须是由字母、数字、下划线和点组成的安全路径')
  if (body.callbackUrl && !(/^\/(?!\/)/.test(body.callbackUrl) || /^https?:\/\//.test(body.callbackUrl))) throw failure('回调地址必须是以 / 开头的系统内路径或 HTTP(S) 地址')
}

async function prepareClientSecret(body, direction, existingHash = null) {
  if (direction !== 'outbound' || body.protocol !== 'ticket') return null
  const secret = String(body.clientSecret || '').trim()
  if (!secret && existingHash) return existingHash
  if (secret.length < 16) throw failure('客户端密钥不能少于 16 位')
  return bcrypt.hash(secret, 12)
}

function configValues(body, direction, secretHash) {
  return [body.code, body.name, direction, body.protocol, body.systemUrl, body.verifyUrl || null, body.authorizeUrl || null, body.callbackUrl || null, body.issuer || null, body.clientId || null, secretHash, body.userIdentifier || 'userId', Number(body.ticketTtlSeconds) || 30, body.enabled !== false, body.remark || null, Number(body.priority) || 1]
}

function updateValues(body, direction, id, secretHash) {
  return [body.name, body.protocol, body.systemUrl, body.verifyUrl || null, body.authorizeUrl || null, body.callbackUrl || null, body.issuer || null, body.clientId || null, secretHash, body.userIdentifier || 'userId', Number(body.ticketTtlSeconds) || 30, body.enabled !== false, body.remark || null, Number(body.priority) || 1, id, direction]
}

export function createSsoService(repository, mapUser) {
  return {
    async exchangeInbound(code, ticket) {
      if (!ticket) throw failure('缺少 ticket')
      const config = await repository.findEnabledInbound(code)
      if (!config) throw failure('未找到已启用的外部跳转访入配置', 404)
      if (config.protocol !== 'ticket') throw failure(`${config.protocol.toUpperCase()} 协议暂未接入认证适配器`, 501)
      if (!config.verify_url) throw failure('该单点登录配置未设置校验地址')
      let response
      try {
        response = await fetch(config.verify_url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }), signal: AbortSignal.timeout(8000) })
      } catch { throw failure('无法连接单点登录校验服务', 502) }
      if (!response.ok) throw failure('单点登录凭证无效、已过期或已使用', 401)
      let identity
      try { identity = await response.json() } catch { throw failure('单点登录校验服务未返回 JSON 用户信息', 502) }
      const userId = readIdentityField(identity, config.user_identifier)
      if (!userId) throw failure(`单点登录校验结果未包含 ${config.user_identifier} 用户标识`, 401)
      const row = await repository.findUserByCode(String(userId))
      if (!row) throw failure('用户尚未配置门户权限', 403)
      return { user: mapUser(row), redirectUrl: config.callback_url || '/' }
    },
    async verifyOutbound(code, ticket, clientSecret) {
      if (!ticket || !clientSecret) throw failure('Ticket 或目标系统凭证无效', 401)
      const config = await repository.findEnabledOutbound(code)
      if (!config?.client_secret_hash || !await bcrypt.compare(clientSecret, config.client_secret_hash)) throw failure('Ticket 或目标系统凭证无效', 401)
      const row = await repository.consumeTicket(config.id, hashTicket(ticket))
      if (!row) throw failure('Ticket 无效、已过期或已使用', 401)
      return buildOutboundIdentity(mapUser(row), config.user_identifier)
    },
    async launchOutbound(appId, user) {
      const config = await repository.findLaunchConfig(appId, user.id)
      if (!config) throw failure('未找到可用的内部访出 Ticket 配置', 404)
      if (!config.client_secret_hash) throw failure('内部访出配置尚未设置客户端密钥')
      const ticket = createTicket()
      const expiresAt = new Date(Date.now() + Number(config.ticket_ttl_seconds || 30) * 1000)
      await repository.issueTicket(hashTicket(ticket), config.id, user.id, expiresAt)
      await repository.deleteExpiredTickets().catch(() => {})
      return { redirectUrl: buildTicketRedirect(config.system_url, config.code, ticket), expiresAt: expiresAt.toISOString() }
    },
    async resolveOutboundConfigId(value) {
      if (value === undefined || value === null || value === '') return null
      const id = Number(value)
      if (!Number.isSafeInteger(id) || id < 1) throw failure('内部访出配置无效')
      if (!await repository.findOutboundTicketConfigId(id)) throw failure('只能关联 Ticket 类型的内部访出配置')
      return id
    },
    async list(direction) {
      return (await repository.list(direction)).map(mapSsoConfig)
    },
    async create(body, direction) {
      validateConfig(body, direction)
      const secretHash = await prepareClientSecret(body, direction)
      return repository.create(configValues(body, direction, secretHash))
    },
    async update(id, body, direction) {
      validateConfig(body, direction)
      const existing = await repository.findForUpdate(id, direction)
      if (!existing) throw failure('单点登录配置不存在', 404)
      const secretHash = await prepareClientSecret(body, direction, existing.client_secret_hash)
      await repository.update(updateValues(body, direction, id, secretHash))
    },
    setEnabled(id, direction, enabled) {
      return repository.setEnabled(id, direction, enabled)
    },
    deleteMany(ids, direction) {
      return ids.length ? repository.deleteMany(ids, direction) : undefined
    },
    deleteOne(id, direction) {
      return repository.deleteOne(id, direction)
    },
  }
}
