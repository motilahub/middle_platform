export function registerModelProviderRoutes(app, controller, { asyncRoute, requirePermission }) {
  app.get('/api/admin/model-providers', requirePermission('platform.model_provider.read'), asyncRoute(controller.list))
  app.post('/api/admin/model-providers', requirePermission('platform.model_provider.create'), asyncRoute(controller.create))
  app.put('/api/admin/model-providers/:id', requirePermission('platform.model_provider.write'), asyncRoute(controller.update))
  app.post('/api/admin/model-providers/:id/test', requirePermission('platform.model_provider.read'), asyncRoute(controller.test))
  app.post('/api/admin/model-providers/:id/models', requirePermission('platform.model_provider.write'), asyncRoute(controller.syncModels))
  app.patch('/api/admin/model-providers/:id/enabled', requirePermission('platform.model_provider.write'), asyncRoute(controller.setEnabled))
  app.delete('/api/admin/model-providers', requirePermission('platform.model_provider.unlink'), asyncRoute(controller.deleteMany))
  app.delete('/api/admin/model-providers/:id', requirePermission('platform.model_provider.unlink'), asyncRoute(controller.deleteOne))
}
