import express from 'express'
import { createDoubanProvider } from './doubanProvider.js'
import { createNiuniuProvider } from './niuniuProvider.js'
import { createPlayableSearch } from './playableSearch.js'
import { createPosterProxy } from './posterProxy.js'
import { createMediaLibraryRepository } from './repository.js'
import { createMediaLibraryService } from './service.js'

export const manifest = {
  key: 'media-library',
  version: '0.1.0',
  dependencies: ['platform.identity', 'platform.workbench'],
  permissions: [
    { code: 'media.library.read', name: '查看影视库管理' },
    { code: 'media.library.create', name: '新增影视' },
    { code: 'media.library.write', name: '编辑影视' },
    { code: 'media.library.unlink', name: '删除影视' },
    { code: 'media.library.sync', name: '同步影视榜单' },
    { code: 'media.library.manage', name: '管理影视库' },
  ],
  enabledByDefault: true,
}

export function createMediaLibraryRouter(service, { asyncRoute, requirePermission, requireAnyPermission }) {
  const router = express.Router()
  const mayRead = requireAnyPermission(['media.library.read', 'media.library.manage'])
  const mayCreate = requireAnyPermission(['media.library.create', 'media.library.manage'])
  const mayWrite = requireAnyPermission(['media.library.write', 'media.library.manage'])
  const mayDelete = requireAnyPermission(['media.library.unlink', 'media.library.manage'])
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  router.get('/items', asyncRoute(async (req, res) => res.json(await service.list(String(req.query.type || 'movie'), req.query.q))))
  router.get('/items/:id/poster', asyncRoute(async (req, res) => {
    const poster = await service.getPoster(req.params.id)
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')
    res.type(poster.contentType).send(poster.body)
  }))
  router.get('/items/:id', asyncRoute(async (req, res) => res.json(await service.get(req.params.id))))
  router.post('/sync', requirePermission('media.library.sync'), asyncRoute(async (_req, res) => res.json(await service.sync())))
  router.post('/progress-sync', requirePermission('media.library.sync'), asyncRoute(async (_req, res) => res.json(await service.refreshEpisodeProgress())))
  router.post('/playable-search', asyncRoute(async (req, res) => res.json(await service.searchPlayable(req.body || {}))))
  router.get('/admin/items', mayRead, asyncRoute(async (req, res) => res.json(await service.adminList(String(req.query.type || 'all'), req.query.q))))
  router.post('/admin/items', mayCreate, asyncRoute(async (req, res) => res.status(201).json(await service.createItem(req.body || {}))))
  router.put('/admin/items/:id', mayWrite, asyncRoute(async (req, res) => res.json(await service.updateItem(req.params.id, req.body || {}))))
  router.delete('/admin/items', mayDelete, asyncRoute(async (req, res) => res.json(await service.deleteItems(req.body?.ids))))
  router.delete('/admin/items/:id', mayDelete, asyncRoute(async (req, res) => res.json(await service.deleteItems([req.params.id]))))
  router.get('/admin/poster', mayRead, asyncRoute(async (req, res) => {
    const poster = await service.getExternalPoster(req.query.url)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.type(poster.contentType).send(poster.body)
  }))
  router.post('/admin/douban-search', mayCreate, asyncRoute(async (req, res) => res.json(await service.searchDouban(req.body?.keyword))))
  router.post('/admin/import', mayCreate, asyncRoute(async (req, res) => res.json(await service.importDouban(req.body || {}))))
  return router
}

export function createModule({ pool, asyncRoute, requirePermission, requireAnyPermission }, options = {}) {
  const repository = createMediaLibraryRepository(pool)
  const provider = createDoubanProvider(options.doubanProvider)
  const niuniuEnabledValue = options.niuniuProvider?.enabled ?? process.env.NIUNIU_PLAYABLE_ENABLED
  const niuniuEnabled = niuniuEnabledValue === undefined || !['0', 'false', 'off', 'no'].includes(String(niuniuEnabledValue).trim().toLowerCase())
  const playableProviders = [
    ...(niuniuEnabled ? [createNiuniuProvider(options.niuniuProvider)] : []),
    ...(options.playableProviders || []),
  ]
  const playableSearch = createPlayableSearch(playableProviders)
  const posterProxy = createPosterProxy(options.posterProxy)
  const service = createMediaLibraryService(repository, provider, playableSearch, { ...options, posterProxy })
  const router = createMediaLibraryRouter(service, { asyncRoute, requirePermission, requireAnyPermission })
  const configuredInterval = Number(options.progressSyncIntervalMs ?? process.env.MEDIA_LIBRARY_PROGRESS_SYNC_INTERVAL_MS ?? 21600000)
  const progressSyncIntervalMs = configuredInterval <= 0 ? 0 : Math.max(5 * 60 * 1000, configuredInterval)
  let progressTimer
  return {
    manifest,
    service,
    async migrate() {
      await pool.query(`INSERT INTO permission_group_permissions(group_id,permission_id)
        SELECT groups.id,permissions.id FROM permission_groups groups JOIN permissions ON permissions.code IN (
          'media.library.read','media.library.create','media.library.write','media.library.unlink','media.library.sync','media.library.manage')
        WHERE groups.code='platform_admin' ON CONFLICT DO NOTHING`)
      await pool.query(`INSERT INTO dashboard_apps(code,name,priority,url,enabled,visibility)
        VALUES('media_library','影视库',COALESCE((SELECT MAX(priority) + 1 FROM dashboard_apps),1),'/media-library',TRUE,'public')
        ON CONFLICT(code) DO UPDATE SET name='影视库',url='/media-library',updated_at=NOW()`)
    },
    register(app) {
      app.use('/api/media-library', router)
    },
    start() {
      if (!progressSyncIntervalMs) return
      progressTimer = setInterval(() => {
        service.refreshEpisodeProgress().catch((error) => console.error('影视剧集进度自动刷新失败', error))
      }, progressSyncIntervalMs)
      progressTimer.unref?.()
    },
    stop() {
      if (progressTimer) clearInterval(progressTimer)
      progressTimer = undefined
    },
  }
}
