import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

async function compressedThumbnail(buffer) {
  for (const size of [320, 256, 192]) {
    for (const quality of [82, 70, 58, 46, 34]) {
      const output = await sharp(buffer).resize(size, size, { fit: 'cover' }).webp({ quality }).toBuffer()
      if (output.length <= 100 * 1024) return output
    }
  }
  return sharp(buffer).resize(160, 160, { fit: 'cover' }).webp({ quality: 28 }).toBuffer()
}

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
      await fs.writeFile(path.join(uploadRoot, thumbnail.replace('/uploads/', '')), await compressedThumbnail(buffer))
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
