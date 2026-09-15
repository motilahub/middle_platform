import test from 'node:test'
import assert from 'node:assert/strict'
import { loadBusinessModules, orderModules, parseEnabledModules } from './module-loader.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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

test('default-enabled modules load when no explicit module is configured', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'middle-platform-modules-'))
  await fs.mkdir(path.join(directory, 'default-module'))
  await fs.writeFile(path.join(directory, 'default-module', 'index.js'), `export const manifest = { key: 'default-module', enabledByDefault: true }; export function createModule() { return { manifest, register() {} } }`)
  try {
    const modules = await loadBusinessModules({ directory, enabled: '', dependencies: {} })
    assert.deepEqual(modules.map((module) => module.key), ['default-module'])
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
