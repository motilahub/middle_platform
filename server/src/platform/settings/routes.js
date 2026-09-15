export function registerSettingsRoutes(app, controller, { asyncRoute, requirePermission }) {
  app.get('/api/system/settings', asyncRoute(controller.system))
  app.get('/api/admin/system-settings', requirePermission('platform.settings.read'), asyncRoute(controller.system))
  app.put('/api/admin/system-settings', requirePermission('platform.settings.write'), asyncRoute(controller.updateSystem))
  app.get('/api/admin/ai-chat-settings', requirePermission('platform.settings.read'), asyncRoute(controller.aiChat))
  app.put('/api/admin/ai-chat-settings', requirePermission('platform.settings.write'), asyncRoute(controller.updateAiChat))
  app.get('/api/admin/security-settings', requirePermission('platform.settings.read'), asyncRoute(controller.security))
  app.put('/api/admin/security-settings', requirePermission('platform.settings.write'), asyncRoute(controller.updateSecurity))
}
