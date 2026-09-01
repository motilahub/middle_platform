import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export function createWorkbenchImageStore(uploadRoot) {
  return {
    async persist(dataUrl, fileName, oldApp) {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) return { original: dataUrl || null, thumbnail: null, filename: fileName || null }
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      if (!match) throw Object.assign(new Error('图片格式无效'), { status: 400 })
      const buffer = Buffer.from(match[2], 'base64')
      if (buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('图片不能超过 10MB'), { status: 400 })
      const stem = crypto.randomUUID()
      const extension = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg'
      const original = `/uploads/original/${stem}.${extension}`
      const thumbnail = `/uploads/thumbnail/${stem}.webp`
      await fs.writeFile(path.join(uploadRoot, original.replace('/uploads/', '')), buffer)
      await sharp(buffer).resize(320, 320, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(uploadRoot, thumbnail.replace('/uploads/', '')))
      await this.remove(oldApp)
      return { original, thumbnail, filename: fileName || `icon.${extension}` }
    },
    async remove(row) {
      for (const value of [row?.image_original, row?.image_thumbnail]) {
        if (value?.startsWith('/uploads/')) await fs.unlink(path.join(uploadRoot, value.replace('/uploads/', ''))).catch(() => {})
      }
    },
  }
}

