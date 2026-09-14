export function createModelProviderController(service) {
  return {
    list: async (_req, res) => res.json(await service.list()),
    create: async (req, res) => res.status(201).json({ id: await service.create(req.body) }),
    update: async (req, res) => { await service.update(req.params.id, req.body); res.status(204).end() },
    test: async (req, res) => res.json(await service.test(req.params.id)),
    syncModels: async (req, res) => res.json(await service.syncModels(req.params.id)),
    setEnabled: async (req, res) => { await service.setEnabled(req.params.id, req.body.enabled); res.status(204).end() },
    deleteMany: async (req, res) => { await service.deleteMany((req.body.ids || []).map(Number)); res.status(204).end() },
    deleteOne: async (req, res) => { await service.deleteOne(req.params.id); res.status(204).end() },
  }
}
