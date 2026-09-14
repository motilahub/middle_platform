import { asyncRoute } from '../../middleware/http.js'

export function createHealthModule(pool) {
  return {
    registerRoutes(app, { rateLimiter }) {
      app.get('/api/health', rateLimiter, asyncRoute(async (_req, res) => {
        await pool.query('SELECT 1')
        res.json({ status: 'ok' })
      }))
    },
  }
}

