export function registerIdentityPublicRoutes(app, sessionSecurity) {
  app.get('/api/auth/csrf', (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ token: sessionSecurity.issueCsrfToken(req) })
  })
}

export function registerIdentityRoutes(app, controller, { asyncRoute, requireAuth, requireAdmin }) {
  app.post('/api/auth/login', asyncRoute(controller.login))
  app.post('/api/auth/logout', controller.logout)
  app.get('/api/auth/me', requireAuth, controller.me)
  app.get('/api/admin/users', requireAdmin, asyncRoute(controller.list))
  app.post('/api/admin/users', requireAdmin, asyncRoute(controller.create))
  app.put('/api/admin/users/:id', requireAdmin, asyncRoute(controller.update))
  app.delete('/api/admin/users/:id', requireAdmin, asyncRoute(controller.remove))
}
