import test from 'node:test'
import assert from 'node:assert/strict'
import { registerApiModules } from './module-contract.js'

test('API modules register in declaration order', () => {
  const calls = []
  registerApiModules({}, {}, [
    { key: 'platform.identity', register: () => calls.push('identity') },
    { key: 'education.sunny-class', register: () => calls.push('sunny-class') },
  ])
  assert.deepEqual(calls, ['identity', 'sunny-class'])
})

test('API module keys must be unique and complete', () => {
  assert.throws(
    () => registerApiModules({}, {}, [
      { key: 'finance', register: () => {} },
      { key: 'finance', register: () => {} },
    ]),
    /重复注册/,
  )
  assert.throws(() => registerApiModules({}, {}, [{ key: '', register: () => {} }]), /key 和 register/)
})
