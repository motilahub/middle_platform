export function registerWorkbenchRoutes(app, controller, { asyncRoute, requireAuth, requireAdmin }) {
  app.get('/api/me/apps', requireAuth, asyncRoute(controller.visible))
  app.get('/api/admin/apps', requireAdmin, asyncRoute(controller.list))
  app.post('/api/admin/apps', requireAdmin, asyncRoute(controller.create))
  app.put('/api/admin/apps/:id', requireAdmin, asyncRoute(controller.update))
  app.patch('/api/admin/apps/:id/visible', requireAdmin, asyncRoute(controller.setEnabled))
  app.post('/api/admin/apps/reorder', requireAdmin, asyncRoute(controller.reorder))
  app.delete('/api/admin/apps', requireAdmin, asyncRoute(controller.deleteMany))
  app.delete('/api/admin/apps/:id', requireAdmin, asyncRoute(controller.deleteOne))
}

