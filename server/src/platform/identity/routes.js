export function registerIdentityPublicRoutes(app, sessionSecurity) {
  app.get('/api/auth/csrf', (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ token: sessionSecurity.issueCsrfToken(req) })
  })
}

export function registerIdentityRoutes(app, controller, { asyncRoute, requireAuth, requirePermission, requireAnyPermission }) {
  app.post('/api/auth/login', asyncRoute(controller.login))
  app.post('/api/auth/logout', controller.logout)
  app.get('/api/auth/me', requireAuth, controller.me)
  app.get('/api/admin/users', requirePermission('platform.user.read'), asyncRoute(controller.list))
  app.get('/api/admin/permission-groups', requireAnyPermission(['platform.user.read', 'platform.permission.read']), asyncRoute(controller.listGroups))
  app.get('/api/admin/permissions', requirePermission('platform.permission.read'), asyncRoute(controller.listPermissionDefinitions))
  app.post('/api/admin/permission-groups', requirePermission('platform.permission.create'), asyncRoute(controller.createGroup))
  app.put('/api/admin/permission-groups/:id', requirePermission('platform.permission.write'), asyncRoute(controller.updateGroup))
  app.delete('/api/admin/permission-groups/:id', requirePermission('platform.permission.unlink'), asyncRoute(controller.deleteGroup))
  app.post('/api/admin/users', requirePermission('platform.user.create'), asyncRoute(controller.create))
  app.put('/api/admin/users/:id', requirePermission('platform.user.write'), asyncRoute(controller.update))
  app.delete('/api/admin/users/:id', requirePermission('platform.user.unlink'), asyncRoute(controller.remove))
}
