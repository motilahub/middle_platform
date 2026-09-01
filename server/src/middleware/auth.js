export function requireAuth(req, res, next) {
  return req.session.user ? next() : res.status(401).json({ message: '请先登录' })
}

export function requireAdmin(req, res, next) {
  return req.session.user && req.session.user.role !== 'user'
    ? next()
    : res.status(403).json({ message: '没有管理权限' })
}

