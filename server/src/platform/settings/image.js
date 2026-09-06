import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const MAX_DISPLAY_BYTES = 100 * 1024

async function compressedWebp(buffer, fit = 'inside') {
  for (const size of [512, 384, 256]) {
    for (const quality of [88, 76, 64, 52, 40]) {
      const output = await sharp(buffer).rotate().resize(size, size, { fit, withoutEnlargement: true }).webp({ quality }).toBuffer()
      if (output.length <= MAX_DISPLAY_BYTES) return output
    }
  }
  return sharp(buffer).rotate().resize(192, 192, { fit }).webp({ quality: 30 }).toBuffer()
}

export function createSettingsImageStore(uploadRoot) {
  const isSystemImage = (value) => typeof value === 'string' && /^\/uploads\/(?:system|original)\/[a-z0-9-]+\.(?:webp|gif|png|jpe?g|apng)$/i.test(value)
  const remove = async (...values) => { for (const value of values) if (isSystemImage(value)) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {}) }
  const extensionFor = (mime) => mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  return {
    async persist(value, oldValue, oldOriginal) {
      const image = typeof value === 'string' ? value : ''
      if (!image) { await remove(oldValue, oldOriginal); return { display: null, original: null } }
      if (image === oldValue && isSystemImage(image)) return { display: image, original: oldOriginal || image }
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      if (!match) throw Object.assign(new Error('请上传有效的图片文件'), { status: 400 })
      const buffer = Buffer.from(match[2], 'base64')
      if (buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('系统标识图片不能超过 2MB'), { status: 400 })
      const stem = crypto.randomUUID()
      const display = `/uploads/system/${stem}.webp`
      const original = `/uploads/original/${stem}.${extensionFor(match[1])}`
      await Promise.all([fs.writeFile(path.join(uploadRoot, display.replace('/uploads/', '')), await compressedWebp(buffer)), fs.writeFile(path.join(uploadRoot, original.replace('/uploads/', '')), buffer)])
      await remove(oldValue, oldOriginal)
      return { display, original }
    },
    async persistIcon(value, oldValue, oldOriginal) {
      const image = typeof value === 'string' ? value : ''
      if (!image) { await remove(oldValue, oldOriginal); return { display: null, original: null } }
      if (image === oldValue && /^\/uploads\/system\/[a-z0-9-]+\.(?:webp|gif|png|jpe?g|apng)$/i.test(image)) return { display: image, original: oldOriginal || image }
      const match = image.match(/^data:(image\/(?:gif|png|jpe?g|webp|apng));base64,(.+)$/i)
      if (!match) throw Object.assign(new Error('请上传有效的机器人图片'), { status: 400 })
      const buffer = Buffer.from(match[2], 'base64')
      if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('机器人图片不能超过 2MB'), { status: 400 })
      const stem = crypto.randomUUID()
      const display = `/uploads/system/${stem}.webp`
      const original = `/uploads/original/${stem}.${extensionFor(match[1])}`
      await Promise.all([fs.writeFile(path.join(uploadRoot, display.replace('/uploads/', '')), await compressedWebp(buffer, 'cover')), fs.writeFile(path.join(uploadRoot, original.replace('/uploads/', '')), buffer)])
      await remove(oldValue, oldOriginal)
      return { display, original }
    },
  }
}
