# 平台后端模块

平台能力按领域拆分，每个目录通过 `index.js` 暴露模块工厂，并由 `bootstrap/module-registry.js` 统一挂载路由。

- `identity`：登录、会话用户和用户管理
- `workbench`：工作台应用、可见范围、排序和图标
- `settings`：系统标识和安全策略
- `sso`：外部访入与内部访出单点登录
- `health`：服务健康检查

模块内部遵循 `routes → controller → service → repository`，公共中间件和映射放在 `server/src/middleware` 与 `server/src/shared`。

