export function createWorkbenchService(repository, mapApp, imageStore, ssoService) {
  const visibility = (value) => value === 'private' ? 'private' : 'public'
  return {
    async visibleApps(userId) { return (await repository.listVisible(userId)).map(mapApp) },
    async adminApps() { return (await repository.listAll()).map(mapApp) },
    async create(body) {
      const ssoConfigId = await ssoService.resolveOutboundConfigId(body.outboundSsoConfigId)
      const image = await imageStore.persist(body.img, body.imgFileName)
      return repository.create([body.code, body.name, body.priority, body.url, body.enabled, image.original, image.thumbnail, image.filename, ssoConfigId, visibility(body.visibility)], body.userIds)
    },
    async update(id, body) {
      const old = await repository.find(id)
      if (!old) throw Object.assign(new Error('记录不存在'), { status: 404 })
      const ssoConfigId = await ssoService.resolveOutboundConfigId(body.outboundSsoConfigId)
      let image = { original: old.image_original, thumbnail: old.image_thumbnail, filename: old.image_filename }
      if (!body.img) { await imageStore.remove(old); image = { original: null, thumbnail: null, filename: null } }
      else if (body.img.startsWith('data:image/')) image = await imageStore.persist(body.img, body.imgFileName, old)
      return repository.update(id, [body.name, body.priority, body.url, body.enabled, image.original, image.thumbnail, image.filename, ssoConfigId, visibility(body.visibility)], body.userIds)
    },
    setEnabled(id, enabled) { return repository.setEnabled(id, enabled) },
    reorder(ids) { return repository.reorder(ids) },
    async deleteMany(ids) { if (!ids.length) return; const rows = await repository.deleteMany(ids); await Promise.all(rows.map(imageStore.remove)) },
    async deleteOne(id) { const row = await repository.deleteOne(id); await imageStore.remove(row) },
  }
}
