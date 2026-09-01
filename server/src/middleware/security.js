import crypto from 'node:crypto'

const defaults = {
  apiRateLimitPerMinute: 30,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireSpecial: true,
  passwordRequireNumber: true,
}

export function createSecurityPolicy() {
  let activeSettings = { ...defaults }
  const buckets = new Map()

  return {
    async load(pool, mapSettings) {
      const result = await pool.query('SELECT api_rate_limit_per_minute,password_min_length,password_require_uppercase,password_require_lowercase,password_require_special,password_require_number,updated_at FROM system_settings WHERE id=1')
      if (result.rows[0]) activeSettings = mapSettings(result.rows[0])
    },
    get settings() {
      return activeSettings
    },
    set settings(value) {
      activeSettings = value
      buckets.clear()
    },
    rateLimiter(req, res, next) {
      const now = Date.now()
      const key = req.ip || req.socket.remoteAddress || 'unknown'
      const attempts = (buckets.get(key) || []).filter((timestamp) => timestamp > now - 60_000)
      if (attempts.length >= activeSettings.apiRateLimitPerMinute) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((attempts[0] + 60_000 - now) / 1000)))
        return res.status(429).json({ message: '接口请求过于频繁，请稍后再试', code: 'API_RATE_LIMITED' })
      }
      attempts.push(now)
      buckets.set(key, attempts)
      next()
    },
    validatePassword(value) {
      const password = String(value || '')
      if (password.length < activeSettings.passwordMinLength) throw Object.assign(new Error(`密码长度不能少于 ${activeSettings.passwordMinLength} 位`), { status: 400 })
      if (activeSettings.passwordRequireUppercase && !/[A-Z]/.test(password)) throw Object.assign(new Error('密码必须包含大写字母'), { status: 400 })
      if (activeSettings.passwordRequireLowercase && !/[a-z]/.test(password)) throw Object.assign(new Error('密码必须包含小写字母'), { status: 400 })
      if (activeSettings.passwordRequireSpecial && !/[^A-Za-z0-9]/.test(password)) throw Object.assign(new Error('密码必须包含特殊符号'), { status: 400 })
      if (activeSettings.passwordRequireNumber && !/\d/.test(password)) throw Object.assign(new Error('密码必须包含数字'), { status: 400 })
      return password
    },
  }
}

export function createSessionSecurity() {
  const issueCsrfToken = (req) => req.session.csrfToken ||= crypto.randomBytes(32).toString('hex')
  const safeEqual = (left, right) => {
    const leftBuffer = Buffer.from(left || '')
    const rightBuffer = Buffer.from(right || '')
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  }
  return {
    issueCsrfToken,
    requireCsrf(req, res, next) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
      const providedToken = String(req.get('x-csrf-token') || '')
      const expectedToken = String(req.session.csrfToken || '')
      if (!providedToken || !expectedToken || !safeEqual(providedToken, expectedToken)) return res.status(403).json({ message: '请求安全校验失败，请刷新页面后重试', code: 'CSRF_INVALID' })
      next()
    },
    async establishSession(req, res, user) {
      await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
      req.session.user = user
      res.setHeader('X-CSRF-Token', issueCsrfToken(req))
    },
  }
}

