import assert from 'node:assert/strict'
import test from 'node:test'
import { createSecretCipher } from './secret-crypto.js'

test('secret cipher encrypts credentials without retaining plaintext', () => {
  const cipher = createSecretCipher('a-long-stable-encryption-key-for-tests')
  const encrypted = cipher.encrypt('sk-sensitive-example')
  assert.ok(encrypted.startsWith('v1:'))
  assert.equal(encrypted.includes('sk-sensitive-example'), false)
  assert.equal(cipher.decrypt(encrypted), 'sk-sensitive-example')
  assert.throws(() => createSecretCipher('different-key').decrypt(encrypted))
})
