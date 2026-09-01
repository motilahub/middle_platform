import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

export function createIdentityService(repository, mapUser, securityPolicy) {
  return {
    async authenticate(code, password) {
      const row = await repository.findByCode(String(code || '').trim())
      if (!row || !await bcrypt.compare(String(password || ''), row.password_hash)) throw Object.assign(new Error('账号或密码错误'), { status: 401 })
      return mapUser(row)
    },
    async list() { return (await repository.list()).map(mapUser) },
    async create(body) {
      const hash = await bcrypt.hash(securityPolicy.validatePassword(body.password), 12)
      return mapUser(await repository.create([crypto.randomUUID(), body.code, body.name, hash, body.role]))
    },
    async update(id, body) {
      const current = await repository.findCode(id)
      if (!current) throw Object.assign(new Error('用户不存在'), { status: 404 })
      const role = current.code === 'admin' ? 'super_admin' : body.role
      const hash = body.password ? await bcrypt.hash(securityPolicy.validatePassword(body.password), 12) : null
      await repository.update(id, [body.name, role, hash])
    },
    async remove(id) {
      const user = await repository.findCode(id)
      if (user?.code === 'admin') throw Object.assign(new Error('超级管理员不可删除'), { status: 400 })
      await repository.remove(id)
    },
  }
}
