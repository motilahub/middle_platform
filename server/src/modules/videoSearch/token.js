import crypto from 'node:crypto'

const TOKEN_TTL_MS = 5 * 60 * 1000

const signatureFor = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('base64url')

export function createResolveToken(data, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: now + TOKEN_TTL_MS })).toString('base64url')
  return `${payload}.${signatureFor(payload, secret)}`
}

export function readResolveToken(token, secret, now = Date.now()) {
  const [payload, signature, extra] = String(token || '').split('.')
  if (!payload || !signature || extra) throw Object.assign(new Error('链接凭证无效，请重新搜索'), { status: 400 })
  const expected = signatureFor(payload, secret)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw Object.assign(new Error('链接凭证无效，请重新搜索'), { status: 400 })
  let data
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { throw Object.assign(new Error('链接凭证无效，请重新搜索'), { status: 400 }) }
  if (!data.expiresAt || data.expiresAt < now) throw Object.assign(new Error('链接凭证已过期，请重新搜索'), { status: 410 })
  return data
}
