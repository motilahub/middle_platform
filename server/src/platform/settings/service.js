export function createSettingsService(repository, imageStore, mappers, securityPolicy) {
  const text = (value, fallback, maxLength) => String(value ?? fallback).trim().slice(0, maxLength)
  const integer = (value, label, min, max) => {
    const number = Number(value)
    if (!Number.isInteger(number) || number < min || number > max) throw Object.assign(new Error(`${label}必须是 ${min}-${max} 之间的整数`), { status: 400 })
    return number
  }
  const boolean = (value, label) => {
    if (typeof value !== 'boolean') throw Object.assign(new Error(`${label}必须为布尔值`), { status: 400 })
    return value
  }
  return {
    async system() { return mappers.mapSystemSettings(await repository.readSystem()) },
    async updateSystem(body) {
      const current = await repository.readSystem()
      const systemTitle = text(body.systemTitle, current.system_title, 120)
      const browserTitle = text(body.browserTitle, current.browser_title, 120)
      if (!systemTitle || !browserTitle) throw Object.assign(new Error('系统标题和浏览器标题不能为空'), { status: 400 })
      const systemLogo = body.systemLogo === undefined ? current.system_logo : await imageStore.persist(body.systemLogo, current.system_logo)
      const titleLogo = body.titleLogo === undefined ? current.title_logo : await imageStore.persist(body.titleLogo, current.title_logo)
      const result = await repository.updateSystem([systemTitle, browserTitle, systemLogo, titleLogo, text(body.loginText, current.login_text, 255), text(body.footerRecord, current.footer_record || '', 255) || null, typeof body.showWorkbenchHeader === 'boolean' ? body.showWorkbenchHeader : current.show_workbench_header])
      return mappers.mapSystemSettings(result)
    },
    async security() { return mappers.mapSecuritySettings(await repository.readSecurity()) },
    async updateSecurity(body) {
      const next = {
        apiRateLimitPerMinute: integer(body.apiRateLimitPerMinute, '每分钟接口请求次数', 1, 10000),
        passwordMinLength: integer(body.passwordMinLength, '密码最小长度', 6, 128),
        passwordRequireUppercase: boolean(body.passwordRequireUppercase, '大写字母要求'),
        passwordRequireLowercase: boolean(body.passwordRequireLowercase, '小写字母要求'),
        passwordRequireSpecial: boolean(body.passwordRequireSpecial, '特殊符号要求'),
        passwordRequireNumber: boolean(body.passwordRequireNumber, '数字要求'),
      }
      const result = await repository.updateSecurity([next.apiRateLimitPerMinute, next.passwordMinLength, next.passwordRequireUppercase, next.passwordRequireLowercase, next.passwordRequireSpecial, next.passwordRequireNumber])
      const mapped = mappers.mapSecuritySettings(result)
      securityPolicy.settings = mapped
      return mapped
    },
  }
}

