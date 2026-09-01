# 后端业务模块

本目录承载行业业务后端模块。每个模块应自包含路由、控制器、服务、仓储、校验、迁移和测试，并由 `bootstrap/module-registry.js` 统一注册。模块 `key` 必须唯一。

推荐结构：

```text
<module-key>/
├── routes.js
├── controller.js
├── service.js
├── repository.js
├── validator.js
├── migrations/
├── tests/
└── index.js
```

模块不得直接读取其他业务模块的数据表。跨模块协作使用平台公开服务、版本化 API 或事件契约。

注册模块需要实现：

```js
{
  key: 'education.sunny-class',
  register(app, dependencies) {
    // 注册本模块路由
  },
}
```
