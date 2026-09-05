import crypto from 'node:crypto'

const version = 'v1'

export function createSecretCipher(secret) {
  if (!secret) throw new Error('缺少模型供应商凭据加密密钥')
  const key = crypto.createHash('sha256').update(String(secret)).digest()
  return {
    encrypt(value) {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
      return [version, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':')
    },
    decrypt(value) {
      const [storedVersion, iv, tag, encrypted] = String(value || '').split(':')
      if (storedVersion !== version || !iv || !tag || !encrypted) throw new Error('模型供应商凭据格式无效')
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
      decipher.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
    },
  }
}
