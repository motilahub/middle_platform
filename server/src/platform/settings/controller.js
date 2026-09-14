export function createSettingsController(service) {
  return {
    system: async (_req, res) => res.json(await service.system()),
    updateSystem: async (req, res) => res.json(await service.updateSystem(req.body)),
    security: async (_req, res) => res.json(await service.security()),
    updateSecurity: async (req, res) => res.json(await service.updateSecurity(req.body)),
  }
}

