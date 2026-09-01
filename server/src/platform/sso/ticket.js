import crypto from 'node:crypto'

export function hashTicket(ticket) {
  return crypto.createHash('sha256').update(String(ticket)).digest('hex')
}

export function createTicket() {
  return crypto.randomBytes(32).toString('base64url')
}

export function buildTicketRedirect(systemUrl, code, ticket) {
  const target = new URL(systemUrl)
  if (!['http:', 'https:'].includes(target.protocol)) throw Object.assign(new Error('目标系统地址必须使用 HTTP(S) 协议'), { status: 400 })
  target.searchParams.set('ssoCode', code)
  target.searchParams.set('ticket', ticket)
  return target.toString()
}

export function isSafeIdentityPath(fieldName) {
  return String(fieldName || '').split('.').every((key) => /^[A-Za-z][A-Za-z0-9_]*$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key))
}

export function buildOutboundIdentity(user, fieldName = 'userId') {
  const payload = {
    userCode: user.code,
    name: user.name,
    uuid: user.uuid,
    role: user.role,
  }
  const path = String(fieldName || 'userId').split('.')
  if (!isSafeIdentityPath(fieldName || 'userId')) {
    throw Object.assign(new Error('用户标识字段必须是由字母、数字、下划线和点组成的安全路径'), { status: 400 })
  }
  let target = payload
  for (const key of path.slice(0, -1)) target = target[key] ||= {}
  target[path.at(-1)] = user.code
  return payload
}
