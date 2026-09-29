import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'

const fail = (message, status = 400) => Object.assign(new Error(message), { status })
const emailValue = (value) => {
  const email = String(value || '').trim().toLowerCase()
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('邮箱格式不正确')
  return email
}
const digest = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex')
const mailReady = (row) => !!(row.smtp_host && row.smtp_user && row.smtp_password_encrypted && row.sender_email)
const auditText = (value, limit) => String(value || '').trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, limit) || null

export function createAuthService(repository, { pool, securityPolicy, cipher, secret, mailer = nodemailer }) {
  const hash = (value) => digest(secret, String(value || '').trim().toLowerCase())
  const audit = async (action, outcome, identifier, context = {}) => {
    try { await repository.event(action, outcome, identifier ? hash(identifier) : null, context.userId, context.ip,
      action === 'login' ? auditText(identifier, 255) : null, action === 'login' ? auditText(context.userAgent, 512) : null) }
    catch (error) { console.error('认证日志写入失败', error) }
  }
  const limited = async (action, identifier, maximum, windowSeconds) => {
    if (!await repository.limit(action, hash(identifier), maximum, windowSeconds)) throw fail('操作过于频繁，请稍后再试', 429)
  }
  const sendMail = async (settings, destination, code, purpose) => {
    const transport = mailer.createTransport({ host: settings.smtp_host, port: settings.smtp_port, secure: settings.smtp_secure, requireTLS: !settings.smtp_secure,
      auth: { user: settings.smtp_user, pass: cipher.decrypt(settings.smtp_password_encrypted) } })
    try {
      await transport.sendMail({ from: settings.sender_email, to: destination, subject: purpose === 'test' ? '邮件服务测试' : purpose === 'register' ? '注册验证码' : '重置密码验证码',
        text: purpose === 'test' ? '邮件服务连接正常。' : `验证码：${code}。5 分钟内有效，最多可尝试 3 次。如非本人操作，请忽略此邮件。` })
    } finally { transport.close() }
  }
  return {
    audit,
    async limitLogin(code, ip, userAgent) {
      try {
        await limited('login_global', 'all', 2000, 900)
        await limited('login_ip', ip, 30, 900)
        await limited('login_account', code, 10, 900)
      } catch (error) { await audit('login', 'limited', code, { ip, userAgent }); throw error }
    },
    async options() { const row = await repository.settings(); return { registrationEnabled: row.registration_enabled && mailReady(row) } },
    async settings() {
      const row = await repository.settings()
      return { registrationEnabled: row.registration_enabled, smtpHost: row.smtp_host || '', smtpPort: row.smtp_port,
        smtpSecure: row.smtp_secure, smtpUser: row.smtp_user || '', senderEmail: row.sender_email || '', hasPassword: !!row.smtp_password_encrypted }
    },
    async updateSettings(body, context) {
      const existing = await repository.settings()
      const host = String(body.smtpHost || '').trim()
      const user = String(body.smtpUser || '').trim()
      const sender = String(body.senderEmail || '').trim()
      const port = Number(body.smtpPort)
      if (host.length > 255 || user.length > 255 || !Number.isInteger(port) || port < 1 || port > 65535) throw fail('SMTP 配置无效')
      if (sender) emailValue(sender)
      const password = String(body.smtpPassword || '')
      const encrypted = password ? cipher.encrypt(password) : existing.smtp_password_encrypted
      if (typeof body.smtpSecure !== 'boolean' || typeof body.registrationEnabled !== 'boolean') throw fail('配置参数无效')
      if (body.registrationEnabled && !(host && user && encrypted && sender)) throw fail('启用注册前请配置发件服务器')
      await repository.saveSettings([body.registrationEnabled, host || null, port, body.smtpSecure, user || null, encrypted, sender || null])
      await audit('mail_settings', 'updated', null, context)
      return this.settings()
    },
    async testMail(destination, context) {
      const settings = await repository.settings()
      if (!mailReady(settings)) throw fail('请先保存完整的发件服务器配置')
      await limited('test_mail', context.userId || context.ip, 5, 3600)
      try { await sendMail(settings, emailValue(destination), '', 'test'); await audit('test_mail', 'sent', destination, context) }
      catch (error) { await audit('test_mail', 'failed', destination, context); throw fail('测试邮件发送失败，请检查服务器配置', 502) }
    },
    async sendCode(purpose, rawEmail, context) {
      if (!['register', 'reset'].includes(purpose)) throw fail('验证码用途无效')
      const email = emailValue(rawEmail)
      const settings = await repository.settings()
      if (!mailReady(settings) || (purpose === 'register' && !settings.registration_enabled)) throw fail('当前无法发送验证码', 403)
      try {
        await limited('code_global', 'all', 200, 3600)
        await limited('code_ip', context.ip, 10, 3600)
        await limited(`code_${purpose}`, email, 5, 3600)
      } catch (error) { await audit(`code_${purpose}`, 'limited', email, context); throw error }
      const existing = await repository.findByEmail(email)
      if (purpose === 'register' && existing) throw fail('邮箱已被使用', 409)
      if (purpose === 'reset' && !existing) { await audit('code_reset', 'requested', email, context); return }
      const code = String(crypto.randomInt(100000, 1000000))
      const codeHash = digest(secret, `${purpose}:${email}:${code}`)
      if (!await repository.issue(purpose, hash(email), codeHash)) { await audit(`code_${purpose}`, 'cooldown', email, context); throw fail('发送过于频繁，请一分钟后重试', 429) }
      try { await sendMail(settings, email, code, purpose); await audit(`code_${purpose}`, 'sent', email, context) }
      catch (error) { await repository.invalidate(purpose, hash(email), codeHash); await audit(`code_${purpose}`, 'failed', email, context); throw fail('邮件发送失败，请稍后重试', 502) }
    },
    async register(body, context) {
      const email = emailValue(body.email)
      const code = String(body.code || '').trim()
      const name = String(body.name || '').trim()
      const login = String(body.login || '').trim()
      const phone = String(body.phone || '').trim()
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,79}$/.test(login) || !name || name.length > 120 || (phone && !/^\+?[0-9 -]{6,32}$/.test(phone))) throw fail('注册资料格式不正确')
      if (!/^\d{6}$/.test(code)) throw fail('验证码格式不正确')
      const settings = await repository.settings()
      if (!settings.registration_enabled || !mailReady(settings)) throw fail('注册尚未开放', 403)
      try {
        await limited('register_ip', context.ip, 10, 3600)
        await limited('register_email', email, 5, 3600)
        const password = await bcrypt.hash(securityPolicy.validatePassword(body.password), 12)
        const consumed = await repository.consume('register', hash(email), digest(secret, `register:${email}:${code}`), async (client) => {
          const result = await client.query(`INSERT INTO users(uuid,code,name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,$5,$6,'user') RETURNING id`, [crypto.randomUUID(), login, name, email, phone || null, password])
          await client.query("INSERT INTO user_permission_groups(user_id,group_id) SELECT $1,id FROM permission_groups WHERE code='platform_user'", [result.rows[0].id])
        })
        if (!consumed) throw fail('验证码无效、已过期或已达到 3 次尝试上限')
        await audit('register', 'success', email, context)
      } catch (error) { await audit('register', error.status === 429 ? 'limited' : 'failed', email, context); throw error }
    },
    async reset(body, context) {
      const email = emailValue(body.email)
      const code = String(body.code || '').trim()
      if (!/^\d{6}$/.test(code)) throw fail('验证码格式不正确')
      try {
        await limited('reset_ip', context.ip, 10, 3600)
        await limited('reset_email', email, 5, 3600)
        const password = await bcrypt.hash(securityPolicy.validatePassword(body.password), 12)
        const consumed = await repository.consume('reset', hash(email), digest(secret, `reset:${email}:${code}`), async (client) => {
          const result = await client.query('UPDATE users SET password_hash=$1,session_version=session_version+1,updated_at=NOW() WHERE lower(email)=$2', [password, email])
          if (!result.rowCount) throw fail('验证码无效、已过期或已达到 3 次尝试上限')
        })
        if (!consumed) throw fail('验证码无效、已过期或已达到 3 次尝试上限')
        await audit('reset', 'success', email, context)
      } catch (error) { await audit('reset', error.status === 429 ? 'limited' : 'failed', email, context); throw error }
    },
    async events(query) {
      const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20))
      const action = String(query.action || '').trim().slice(0, 32)
      const keyword = String(query.keyword || '').trim().slice(0, 100)
      return { ...await repository.events({ page, pageSize, action, keyword }), page, pageSize }
    },
    sessionVersion: (id) => repository.sessionVersion(id),
  }
}
