import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export function createSettingsImageStore(uploadRoot) {
  const isSystemImage = (value) => typeof value === 'string' && /^\/uploads\/system\/[a-z0-9-]+\.webp$/i.test(value)
  const remove = async (value) => { if (isSystemImage(value)) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {}) }
  return {
    async persist(value, oldValue) {
      const image = typeof value === 'string' ? value : ''
      if (!image) { await remove(oldValue); return null }
      if (image === oldValue && isSystemImage(image)) return image
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      if (!match) throw Object.assign(new Error('请上传有效的图片文件'), { status: 400 })
      const buffer = Buffer.from(match[2], 'base64')
      if (buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('系统标识图片不能超过 2MB'), { status: 400 })
      const relative = `/uploads/system/${crypto.randomUUID()}.webp`
      await sharp(buffer).rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(uploadRoot, relative.replace('/uploads/', '')))
      await remove(oldValue)
      return relative
    },
  }
}

