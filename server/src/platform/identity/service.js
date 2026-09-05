import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

export function createIdentityService(repository, mapUser, securityPolicy, permissionService) {
  const enrich = (user) => permissionService.enrich(mapUser(user))
  return {
    async authenticate(code, password) {
      const row = await repository.findByCode(String(code || '').trim())
      if (!row || !await bcrypt.compare(String(password || ''), row.password_hash)) throw Object.assign(new Error('账号或密码错误'), { status: 401 })
      return enrich(row)
    },
    async list() { return Promise.all((await repository.list()).map(enrich)) },
    async listGroups() { return permissionService.listGroups() },
    async listPermissionDefinitions() { return permissionService.listDefinitions() },
    async createGroup(body) { return permissionService.createGroup(body) },
    async updateGroup(id, body) { return permissionService.updateGroup(id, body) },
    async deleteGroup(id) { return permissionService.deleteGroup(id) },
    async create(body) {
      const hash = await bcrypt.hash(securityPolicy.validatePassword(body.password), 12)
      const user = await repository.create([crypto.randomUUID(), body.code, body.name, hash, body.role])
      const groupIds = body.groupIds || await repository.defaultGroupIds(body.role)
      await permissionService.setUserGroups(user.id, groupIds)
      return enrich(user)
    },
    async update(id, body) {
      const current = await repository.findCode(id)
      if (!current) throw Object.assign(new Error('用户不存在'), { status: 404 })
      const role = current.code === 'admin' ? 'super_admin' : body.role
      const hash = body.password ? await bcrypt.hash(securityPolicy.validatePassword(body.password), 12) : null
      await repository.update(id, [body.name, role, hash])
      if (body.groupIds) await permissionService.setUserGroups(id, body.groupIds)
    },
    async remove(id) {
      const user = await repository.findCode(id)
      if (user?.code === 'admin') throw Object.assign(new Error('超级管理员不可删除'), { status: 400 })
      await repository.remove(id)
    },
  }
}
