export const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

export function normalizeVersionedApi(req, _res, next) {
  req.url = req.url.replace(/^\/api\/v1(?=\/|$)/, '/api')
  next()
}

