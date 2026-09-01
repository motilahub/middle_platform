import test from 'node:test'
import assert from 'node:assert/strict'
import { orderModules, parseEnabledModules } from './module-loader.js'

test('enabled module configuration is normalized', () => {
  assert.deepEqual(parseEnabledModules(' finance,education.sunny-class,finance '), ['finance', 'education.sunny-class'])
})

test('modules are ordered after their dependencies', () => {
  const modules = [
    { key: 'education.sunny-class', manifest: { dependencies: ['finance'] } },
    { key: 'finance', manifest: { dependencies: [] } },
  ]
  assert.deepEqual(orderModules(modules).map((module) => module.key), ['finance', 'education.sunny-class'])
})

test('platform dependencies are treated as already available', () => {
  const module = { key: 'finance', manifest: { dependencies: ['platform.identity'] } }
  assert.deepEqual(orderModules([module], new Set(['platform.identity'])), [module])
})

test('dependency cycles are rejected', () => {
  const modules = [
    { key: 'a', manifest: { dependencies: ['b'] } },
    { key: 'b', manifest: { dependencies: ['a'] } },
  ]
  assert.throws(() => orderModules(modules), /循环/)
})

