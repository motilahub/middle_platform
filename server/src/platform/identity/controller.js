export function createIdentityController(service, sessionSecurity, authService) {
  return {
    async login(req, res) {
      const code = String(req.body?.code || '').trim()
      await authService.limitLogin(code, req.ip)
      try {
        const user = await service.authenticate(code, req.body?.password)
        await sessionSecurity.establishSession(req, res, user)
        await authService.audit('login', 'success', code, { userId: user.id, ip: req.ip })
        res.json(user)
      } catch (error) { await authService.audit('login', 'failed', code, { ip: req.ip }); throw error }
    },
    options: async (_req, res) => res.json(await authService.options()),
    sendCode: async (req, res) => { await authService.sendCode(req.body?.purpose, req.body?.email, { ip: req.ip }); res.status(202).json({ message: '如可发送，验证码将发至该邮箱' }) },
    register: async (req, res) => { await authService.register(req.body || {}, { ip: req.ip }); res.status(201).json({ message: '注册成功，请登录' }) },
    resetPassword: async (req, res) => { await authService.reset(req.body || {}, { ip: req.ip }); res.status(204).end() },
    mailSettings: async (_req, res) => res.json(await authService.settings()),
    updateMailSettings: async (req, res) => res.json(await authService.updateSettings(req.body, { ip: req.ip, userId: req.session.user.id })),
    testMail: async (req, res) => { await authService.testMail(req.body.email, { ip: req.ip, userId: req.session.user.id }); res.status(204).end() },
    authEvents: async (req, res) => res.json(await authService.events(req.query)),
    async logout(req, res) {
      await authService.audit('logout', 'success', req.session.user?.code, { userId: req.session.user?.id, ip: req.ip })
      return req.session.destroy((error) => {
        if (error) return res.status(500).json({ message: '退出登录失败' })
        res.clearCookie('connect.sid', req.app.locals.sessionCookie)
        res.status(204).end()
      })
    },
    me(req, res) { res.json(req.session.user) },
    async updateProfile(req, res) { const user = await service.updateProfile(req.session.user.id, req.body); req.session.user = user; res.json(user) },
    async list(req, res) { res.json(await service.list()) },
    async listGroups(req, res) { res.json(await service.listGroups()) },
    async listPermissionDefinitions(req, res) { res.json(await service.listPermissionDefinitions()) },
    async createGroup(req, res) { res.status(201).json({ id: await service.createGroup(req.body) }) },
    async updateGroup(req, res) { await service.updateGroup(req.params.id, req.body); res.status(204).end() },
    async deleteGroup(req, res) { await service.deleteGroup(req.params.id); res.status(204).end() },
    async create(req, res) { res.status(201).json(await service.create(req.body)) },
    async update(req, res) { const user = await service.update(req.params.id, req.body); if (Number(req.params.id) === Number(req.session.user?.id)) req.session.user = user; res.json(user) },
    async remove(req, res) { await service.remove(req.params.id); res.status(204).end() },
  }
}
