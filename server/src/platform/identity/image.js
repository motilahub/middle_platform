import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_BYTES = 100 * 1024

export function createIdentityImageStore(uploadRoot) {
  const isStoredAvatar = (value) => typeof value === 'string' && /^\/uploads\/(?:thumbnail|original)\/avatar-[a-z0-9-]+\.(?:webp|png|jpe?g)$/i.test(value)
  const remove = async (...values) => { for (const value of values) if (isStoredAvatar(value)) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {}) }
  const compress = async (buffer) => {
    const { default: sharp } = await import('sharp')
    for (const size of [256, 192, 128]) {
      for (const quality of [82, 70, 58, 46, 34]) {
        const output = await sharp(buffer).rotate().resize(size, size, { fit: 'cover', withoutEnlargement: true }).webp({ quality }).toBuffer()
        if (output.length <= MAX_BYTES) return output
      }
    }
    return sharp(buffer).rotate().resize(96, 96, { fit: 'cover' }).webp({ quality: 25 }).toBuffer()
  }
  return {
    async persistAvatar(value, oldValue, oldOriginal, originalValue) {
      const image = typeof value === 'string' ? value.trim() : ''
      if (!image) { await remove(oldValue, oldOriginal); return { thumbnail: null, original: null } }
      if (image === oldValue && isStoredAvatar(image)) return { thumbnail: image, original: oldOriginal || image }
      const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
      if (!match) return { thumbnail: image.slice(0, 1000), original: image.slice(0, 1000) }
      const originalMatch = typeof originalValue === 'string' ? originalValue.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i) : null
      const source = originalMatch || match
      const buffer = Buffer.from(source[2], 'base64')
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('头像不能超过 10MB'), { status: 400 })
      const stem = `avatar-${crypto.randomUUID()}`
      const extension = source[1].includes('png') ? 'png' : source[1].includes('webp') ? 'webp' : source[1].includes('gif') ? 'gif' : 'jpg'
      const originalRelative = `/uploads/original/${stem}.${extension}`
      const thumbnailRelative = `/uploads/thumbnail/${stem}.webp`
      const output = await compress(buffer)
      await fs.writeFile(path.join(uploadRoot, originalRelative.replace('/uploads/', '')), buffer)
      await fs.writeFile(path.join(uploadRoot, thumbnailRelative.replace('/uploads/', '')), output)
      await remove(oldValue, oldOriginal)
      return { thumbnail: thumbnailRelative, original: originalRelative }
    },
  }
}
