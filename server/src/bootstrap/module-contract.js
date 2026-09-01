export function registerApiModules(app, dependencies, modules = []) {
  const keys = new Set()
  for (const module of modules) {
    if (!module?.key || typeof module.register !== 'function') throw new Error('API 模块必须提供 key 和 register 函数')
    if (keys.has(module.key)) throw new Error(`API 模块重复注册: ${module.key}`)
    keys.add(module.key)
    module.register(app, dependencies)
  }
}
