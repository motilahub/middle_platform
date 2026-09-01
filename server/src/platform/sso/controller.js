export function createSsoController(service, establishSession) {
  return {
    async verifyOutbound(req, res) {
      res.setHeader('Cache-Control', 'no-store')
      const clientSecret = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''
      res.json(await service.verifyOutbound(req.params.code, String(req.body.ticket || '').trim(), clientSecret))
    },
    async exchangeInbound(req, res) {
      const result = await service.exchangeInbound(req.params.code, String(req.body.ticket || '').trim())
      await establishSession(req, res, result.user)
      res.json({ ...result.user, redirectUrl: result.redirectUrl })
    },
    async launchOutbound(req, res) {
      res.setHeader('Cache-Control', 'no-store')
      res.json(await service.launchOutbound(req.params.id, req.session.user))
    },
    async list(req, res) {
      res.json(await service.list(req.params.direction))
    },
    async create(req, res) {
      res.status(201).json({ id: await service.create(req.body, req.params.direction) })
    },
    async update(req, res) {
      await service.update(req.params.id, req.body, req.params.direction)
      res.status(204).end()
    },
    async setEnabled(req, res) {
      await service.setEnabled(req.params.id, req.params.direction, !!req.body.enabled)
      res.status(204).end()
    },
    async deleteMany(req, res) {
      const ids = (req.body.ids || []).map(Number).filter(Number.isFinite)
      await service.deleteMany(ids, req.params.direction)
      res.status(204).end()
    },
    async deleteOne(req, res) {
      await service.deleteOne(req.params.id, req.params.direction)
      res.status(204).end()
    },
  }
}
