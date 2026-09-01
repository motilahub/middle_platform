# SSO 平台模块

本模块负责平台的外部访入和内部访出单点登录，不负责目标业务系统自身的会话与权限。

## 边界与入口

- `routes.js`：注册兼容现有前端的 SSO HTTP 路径及认证中间件。
- `controller.js`：转换请求、响应并建立平台 Session。
- `service.js`：处理协议校验、Ticket 签发/核销、用户映射和配置规则。
- `repository.js`：封装 `sso_configs`、`outbound_sso_tickets`、工作台应用和用户查询。
- `ticket.js`：无数据库依赖的 Ticket、跳转 URL 和身份响应工具。

模块由 `server/src/index.js` 组合注册。工作台模块只通过 `service.resolveOutboundConfigId` 校验应用关联，不直接实现 SSO 规则。

## 数据与迁移

迁移文件：`server/src/db/migrations/002_add_outbound_ticket_sso.sql`

- `sso_configs.client_secret_hash`：目标系统客户端密钥的 bcrypt 摘要。
- `sso_configs.ticket_ttl_seconds`：Ticket 有效期，范围 5～300 秒。
- `dashboard_apps.outbound_sso_config_id`：工作台应用关联的内部访出配置。
- `outbound_sso_tickets`：只保存 Ticket SHA-256 摘要、用户、配置、过期和核销时间。

兼容升级会保留现有 SSO 和工作台数据。若需回滚代码，先解除工作台应用关联；数据库字段和 Ticket 历史表可以保留，不影响旧版本读取。确认不再需要数据后，才可由单独回滚迁移删除新增表、约束和字段。

## 权限

- Ticket 签发要求平台登录，并复用工作台应用的启用状态和用户可见范围。
- Ticket 核销不使用浏览器 Session/CSRF，由每个目标系统独立的 Bearer 客户端密钥认证。
- SSO 配置管理沿用管理员权限中间件。

## 测试

```bash
cd server
npm test
```

完整目标系统联调参阅 `docs/sso-ticket-outbound-demo.md`。
