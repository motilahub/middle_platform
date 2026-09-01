export function createWorkbenchController(service) {
  return {
    async visible(req, res) { res.json(await service.visibleApps(req.session.user.id)) },
    async list(req, res) { res.json(await service.adminApps()) },
    async create(req, res) { res.status(201).json({ id: await service.create(req.body) }) },
    async update(req, res) { await service.update(req.params.id, req.body); res.status(204).end() },
    async setEnabled(req, res) { await service.setEnabled(req.params.id, !!req.body.enabled); res.status(204).end() },
    async reorder(req, res) { await service.reorder(req.body.ids); res.status(204).end() },
    async deleteMany(req, res) { await service.deleteMany((req.body.ids || []).map(Number)); res.status(204).end() },
    async deleteOne(req, res) { await service.deleteOne(req.params.id); res.status(204).end() },
  }
}

