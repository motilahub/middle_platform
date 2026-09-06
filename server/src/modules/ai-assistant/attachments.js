import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const safeName = (value) => String(value || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._]+/, '').slice(0, 120) || 'attachment'

export function createAiAttachmentStore(uploadRoot) {
  return {
    async save(body = {}) {
      const dataUrl = String(body.dataUrl || '')
      const match = dataUrl.match(/^data:([\w.+-]+\/[-\w.+]+);base64,(.+)$/)
      if (!match) throw Object.assign(new Error('附件数据格式无效'), { status: 400 })
      const buffer = Buffer.from(match[2], 'base64')
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('附件不能超过 10MB'), { status: 400 })
      const directory = path.join(uploadRoot, 'ai')
      await fs.mkdir(directory, { recursive: true })
      const name = safeName(body.name)
      const fileName = `${crypto.randomUUID()}-${name}`
      await fs.writeFile(path.join(directory, fileName), buffer)
      return { name, url: `/uploads/ai/${fileName}`, mime: match[1], size: buffer.length }
    },
  }
}
