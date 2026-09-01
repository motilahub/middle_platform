const directions = new Set(['inbound', 'outbound'])
const requireDirection = (req, res, next) => directions.has(req.params.direction) ? next() : res.status(400).json({ message: '单点登录方向无效' })

export function registerSsoPublicRoutes(app, controller, { asyncRoute, rateLimiter }) {
  app.post('/api/auth/sso/outbound/:code/verify', rateLimiter, asyncRoute(controller.verifyOutbound))
}

export function registerSsoRoutes(app, controller, { asyncRoute, requireAuth, requireAdmin }) {
  app.post('/api/auth/sso/:code/exchange', asyncRoute(controller.exchangeInbound))
  app.post('/api/me/apps/:id/sso-ticket', requireAuth, asyncRoute(controller.launchOutbound))
  app.get('/api/admin/sso/:direction', requireAdmin, requireDirection, asyncRoute(controller.list))
  app.post('/api/admin/sso/:direction', requireAdmin, requireDirection, asyncRoute(controller.create))
  app.put('/api/admin/sso/:direction/:id', requireAdmin, requireDirection, asyncRoute(controller.update))
  app.patch('/api/admin/sso/:direction/:id/enabled', requireAdmin, requireDirection, asyncRoute(controller.setEnabled))
  app.delete('/api/admin/sso/:direction', requireAdmin, requireDirection, asyncRoute(controller.deleteMany))
  app.delete('/api/admin/sso/:direction/:id', requireAdmin, requireDirection, asyncRoute(controller.deleteOne))
}
