import type { ReactElement } from 'react'

/**
 * Business modules register route elements here. The application shell only
 * composes registered modules and does not import individual industry pages.
 */
export interface FrontendModule {
  key: string
  routes: ReactElement[]
}

const modules = new Map<string, FrontendModule>()

export function registerBusinessModule(module: FrontendModule) {
  if (!module.key.trim()) throw new Error('业务模块必须提供非空 key')
  if (modules.has(module.key)) throw new Error(`业务模块重复注册: ${module.key}`)
  modules.set(module.key, module)
}

export function getBusinessRouteElements() {
  return [...modules.values()].flatMap((module) => module.routes)
}
