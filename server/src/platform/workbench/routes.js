export function registerWorkbenchRoutes(app, controller, { asyncRoute, requireAuth, requirePermission }) {
  app.get('/api/workbench/apps', asyncRoute(controller.visible))
  app.get('/api/me/apps', requireAuth, asyncRoute(controller.visible))
  app.get('/api/admin/apps', requirePermission('platform.app.read'), asyncRoute(controller.list))
  app.post('/api/admin/apps', requirePermission('platform.app.create'), asyncRoute(controller.create))
  app.put('/api/admin/apps/:id', requirePermission('platform.app.write'), asyncRoute(controller.update))
  app.patch('/api/admin/apps/:id/visible', requirePermission('platform.app.write'), asyncRoute(controller.setEnabled))
  app.post('/api/admin/apps/reorder', requirePermission('platform.app.write'), asyncRoute(controller.reorder))
  app.delete('/api/admin/apps', requirePermission('platform.app.unlink'), asyncRoute(controller.deleteMany))
  app.delete('/api/admin/apps/:id', requirePermission('platform.app.unlink'), asyncRoute(controller.deleteOne))
}
