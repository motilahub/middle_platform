import test from 'node:test'
import assert from 'node:assert/strict'
import { createSecurityPolicy } from './security.js'

test('security policy uses permissive initialization defaults and validates configured password rules', () => {
  const policy = createSecurityPolicy()
  assert.equal(policy.settings.apiRateLimitPerMinute, 10000)
  assert.equal(policy.settings.passwordMinLength, 6)
  assert.equal(policy.validatePassword('weakpass'), 'weakpass')
  assert.throws(() => policy.validatePassword('short'), /密码长度/)
  policy.settings = {
    apiRateLimitPerMinute: 10,
    passwordMinLength: 6,
    passwordRequireUppercase: false,
    passwordRequireLowercase: true,
    passwordRequireSpecial: false,
    passwordRequireNumber: true,
  }
  assert.equal(policy.validatePassword('strong1'), 'strong1')
})
