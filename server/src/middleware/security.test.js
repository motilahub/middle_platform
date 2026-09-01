import test from 'node:test'
import assert from 'node:assert/strict'
import { createSecurityPolicy } from './security.js'

test('security policy validates configured password rules', () => {
  const policy = createSecurityPolicy()
  assert.throws(() => policy.validatePassword('weakpass'), /大写字母/)
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
