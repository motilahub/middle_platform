import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const platformKeys = new Set(['platform.identity', 'platform.workbench', 'platform.settings', 'platform.sso', 'platform.health'])

export function parseEnabledModules(value = '') {
  return [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))]
}

function validateModule(module, source) {
  const manifest = module?.manifest || module
  if (!manifest?.key || typeof module?.register !== 'function') throw new Error(`模块 ${source} 必须提供 manifest.key 和 register()`)
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(manifest.key)) throw new Error(`模块 ${source} 的 key 无效`)
  if (manifest.dependencies && !Array.isArray(manifest.dependencies)) throw new Error(`模块 ${manifest.key} 的 dependencies 必须是数组`)
  return { ...module, manifest: { version: '0.0.0', dependencies: [], enabledByDefault: false, ...manifest }, key: manifest.key }
}

export function orderModules(modules, availableKeys = new Set()) {
  const byKey = new Map(modules.map((module) => [module.key, module]))
  const visiting = new Set()
  const visited = new Set(availableKeys)
  const ordered = []
  const visit = (module) => {
    if (visited.has(module.key)) return
    if (visiting.has(module.key)) throw new Error(`模块依赖存在循环: ${module.key}`)
    visiting.add(module.key)
    for (const dependency of module.manifest.dependencies || []) {
      if (availableKeys.has(dependency)) continue
      const dependencyModule = byKey.get(dependency)
      if (!dependencyModule) throw new Error(`模块 ${module.key} 依赖未加载模块 ${dependency}`)
      visit(dependencyModule)
    }
    visiting.delete(module.key)
    visited.add(module.key)
    ordered.push(module)
  }
  modules.forEach(visit)
  return ordered
}

export async function loadBusinessModules({ directory, enabled = [], dependencies, platformModuleKeys = platformKeys }) {
  const requested = parseEnabledModules(enabled)
  if (!requested.length) return []
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const candidates = new Map()
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const modulePath = path.join(directory, entry.name, 'index.js')
    try {
      const imported = await import(pathToFileURL(modulePath).href)
      const factory = imported.createModule || imported.default
      const created = typeof factory === 'function' ? await factory(dependencies) : factory
      const module = created && !created.manifest && imported.manifest ? { ...created, manifest: imported.manifest } : created
      if (module) candidates.set(module.manifest?.key || module.key || entry.name, validateModule(module, entry.name))
    } catch (error) {
      if (error?.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes(modulePath)) continue
      throw error
    }
  }
  const modules = requested.map((key) => {
    const module = candidates.get(key)
    if (!module) throw new Error(`启用的业务模块不存在或未导出: ${key}`)
    return module
  })
  const ordered = orderModules(modules, new Set(platformModuleKeys))
  for (const module of ordered) if (typeof module.migrate === 'function') await module.migrate(dependencies)
  return ordered
}

export async function startModules(modules, dependencies) {
  for (const module of modules) if (typeof module.start === 'function') await module.start(dependencies)
}

export async function stopModules(modules, dependencies) {
  for (const module of [...modules].reverse()) if (typeof module.stop === 'function') await module.stop(dependencies)
}
