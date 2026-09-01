export function registerSettingsRoutes(app, controller, { asyncRoute, requireAdmin }) {
  app.get('/api/system/settings', asyncRoute(controller.system))
  app.get('/api/admin/system-settings', requireAdmin, asyncRoute(controller.system))
  app.put('/api/admin/system-settings', requireAdmin, asyncRoute(controller.updateSystem))
  app.get('/api/admin/security-settings', requireAdmin, asyncRoute(controller.security))
  app.put('/api/admin/security-settings', requireAdmin, asyncRoute(controller.updateSecurity))
}

