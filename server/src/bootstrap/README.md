# 模块启动与加载

`module-registry.js` 负责平台核心模块的公共/受保护路由注册阶段；`module-loader.js` 负责可选业务模块的发现、清单校验、依赖排序、迁移和生命周期。

业务模块可以导出 `createModule(dependencies)` 或默认模块对象，至少提供：

```js
export const manifest = {
  key: 'education.sunny-class',
  version: '1.0.0',
  dependencies: ['platform.identity'],
}

export function createModule(dependencies) {
  return {
    manifest,
    register(app, context) {},
    async migrate(context) {},
    async start(context) {},
    async stop(context) {},
  }
}
```

使用 `ENABLED_MODULES` 配置启用模块，模块依赖的平台核心能力由启动器自动视为已满足。

