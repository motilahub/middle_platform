export function createIdentityController(service, sessionSecurity) {
  return {
    async login(req, res) {
      const user = await service.authenticate(req.body.code, req.body.password)
      await sessionSecurity.establishSession(req, res, user)
      res.json(user)
    },
    logout(req, res) {
      return req.session.destroy((error) => {
        if (error) return res.status(500).json({ message: '退出登录失败' })
        res.clearCookie('connect.sid', req.app.locals.sessionCookie)
        res.status(204).end()
      })
    },
    me(req, res) { res.json(req.session.user) },
    async list(req, res) { res.json(await service.list()) },
    async create(req, res) { res.status(201).json(await service.create(req.body)) },
    async update(req, res) { await service.update(req.params.id, req.body); res.status(204).end() },
    async remove(req, res) { await service.remove(req.params.id); res.status(204).end() },
  }
}

