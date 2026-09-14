export function requireAuth(req, res, next) {
  return req.session.user ? next() : res.status(401).json({ message: '请先登录' })
}

export function requireAdmin(req, res, next) {
  return req.session.user && req.session.user.role !== 'user'
    ? next()
    : res.status(403).json({ message: '没有管理权限' })
}

export function createPermissionMiddleware(permissionService) {
  return (permission) => (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: '请先登录' })
    if (permissionService.has(req.session.user, permission)) return next()
    return res.status(403).json({ message: `缺少权限：${permission}`, code: 'PERMISSION_DENIED' })
  }
}

export function createAnyPermissionMiddleware(permissionService) {
  return (permissions) => (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: '请先登录' })
    if (permissions.some((permission) => permissionService.has(req.session.user, permission))) return next()
    return res.status(403).json({ message: '缺少访问权限', code: 'PERMISSION_DENIED' })
  }
}
