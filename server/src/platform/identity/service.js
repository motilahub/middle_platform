import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

export function createIdentityService(repository, mapUser, securityPolicy, permissionService, imageStore) {
  const enrich = (user) => permissionService.enrich(mapUser(user))
  const persistAvatar = imageStore?.persistAvatar || (async (value) => { const image = String(value || '').trim().slice(0, 1000) || null; return { thumbnail: image, original: image } })
  return {
    async authenticate(code, password) {
      const row = await repository.findByCode(String(code || '').trim())
      if (!row || !await bcrypt.compare(String(password || ''), row.password_hash)) throw Object.assign(new Error('账号或密码错误'), { status: 401 })
      return enrich(row)
    },
    async list() { return Promise.all((await repository.list()).map(enrich)) },
    async updateProfile(id, body) {
      const current = await repository.findById(id)
      const avatarAssets = body.avatar === undefined ? { thumbnail: current?.avatar_thumbnail || current?.avatar || null, original: current?.avatar_original || current?.avatar || null } : await persistAvatar(body.avatar, current?.avatar_thumbnail || current?.avatar, current?.avatar_original, body.avatarOriginal)
      await repository.updateAvatar(id, [avatarAssets.thumbnail, avatarAssets.original, avatarAssets.thumbnail])
      return enrich(await repository.findById(id))
    },
    async listGroups() { return permissionService.listGroups() },
    async listPermissionDefinitions() { return permissionService.listDefinitions() },
    async createGroup(body) { return permissionService.createGroup(body) },
    async updateGroup(id, body) { return permissionService.updateGroup(id, body) },
    async deleteGroup(id) { return permissionService.deleteGroup(id) },
    async create(body) {
      const hash = await bcrypt.hash(securityPolicy.validatePassword(body.password), 12)
      const avatarAssets = body.avatar ? await persistAvatar(body.avatar, null, null, body.avatarOriginal) : { thumbnail: null, original: null }
      const user = await repository.create([crypto.randomUUID(), body.code, body.name, hash, body.role, avatarAssets.thumbnail, avatarAssets.original, avatarAssets.thumbnail])
      const groupIds = body.groupIds || await repository.defaultGroupIds(body.role)
      await permissionService.setUserGroups(user.id, groupIds)
      return enrich(user)
    },
    async update(id, body) {
      const current = await repository.findCode(id)
      if (!current) throw Object.assign(new Error('用户不存在'), { status: 404 })
      const role = current.code === 'admin' ? 'super_admin' : body.role
      const hash = body.password ? await bcrypt.hash(securityPolicy.validatePassword(body.password), 12) : null
      const avatarAssets = body.avatar === undefined ? { thumbnail: current.avatar_thumbnail || current.avatar || null, original: current.avatar_original || current.avatar || null } : await persistAvatar(body.avatar, current.avatar_thumbnail || current.avatar, current.avatar_original, body.avatarOriginal)
      await repository.update(id, [body.name, role, hash, avatarAssets.thumbnail, avatarAssets.original, avatarAssets.thumbnail])
      if (body.groupIds) await permissionService.setUserGroups(id, body.groupIds)
      return enrich(await repository.findById(id))
    },
    async remove(id) {
      const user = await repository.findCode(id)
      if (user?.code === 'admin') throw Object.assign(new Error('超级管理员不可删除'), { status: 400 })
      await repository.remove(id)
    },
  }
}
