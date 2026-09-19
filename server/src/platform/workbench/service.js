export function createWorkbenchService(repository, mapApp, imageStore, ssoService) {
  const visibility = (value) => value === 'private' ? 'private' : 'public'
  const openMode = (value) => value === 'new_tab' ? 'new_tab' : 'current'
  const categoryId = (value) => {
    if (value === undefined || value === null || value === '') return null
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('控制台分类无效'), { status: 400 })
    return id
  }
  return {
    async visibleApps(userId) { return (await repository.listVisible(userId)).map(mapApp) },
    async adminApps() { return (await repository.listAll()).map(mapApp) },
    async categories() { return (await repository.listCategories()).map((row) => ({ id: Number(row.id), code: row.code, name: row.name, priority: Number(row.priority) })) },
    async createCategory(body) { return repository.createCategory([body.code, body.name, body.priority]) },
    async updateCategory(id, body) { return repository.updateCategory(id, [body.code, body.name, body.priority]) },
    async deleteCategory(id) { return repository.deleteCategory(id) },
    async create(body) {
      const ssoConfigId = await ssoService.resolveOutboundConfigId(body.outboundSsoConfigId)
      const image = await imageStore.persist(body.img, body.imgFileName)
      return repository.create([body.code, body.name, body.priority, categoryId(body.categoryId), body.url, body.enabled, image.original, image.thumbnail, image.filename, ssoConfigId, visibility(body.visibility), openMode(body.openMode)], body.userIds)
    },
    async update(id, body) {
      const old = await repository.find(id)
      if (!old) throw Object.assign(new Error('记录不存在'), { status: 404 })
      const ssoConfigId = await ssoService.resolveOutboundConfigId(body.outboundSsoConfigId)
      const selectedCategoryId = body.categoryId === undefined ? old.category_id : categoryId(body.categoryId)
      let image = { original: old.image_original, thumbnail: old.image_thumbnail, filename: old.image_filename }
      if (!body.img) { await imageStore.remove(old); image = { original: null, thumbnail: null, filename: null } }
      else if (body.img.startsWith('data:image/')) image = await imageStore.persist(body.img, body.imgFileName, old)
      return repository.update(id, [body.name, body.priority, selectedCategoryId, body.url, body.enabled, image.original, image.thumbnail, image.filename, ssoConfigId, visibility(body.visibility), openMode(body.openMode)], body.userIds)
    },
    setEnabled(id, enabled) { return repository.setEnabled(id, enabled) },
    reorder(ids) { return repository.reorder(ids) },
    async deleteMany(ids) { if (!ids.length) return; const rows = await repository.deleteMany(ids); await Promise.all(rows.map(imageStore.remove)) },
    async deleteOne(id) { const row = await repository.deleteOne(id); await imageStore.remove(row) },
  }
}
