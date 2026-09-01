# 内部访出 Ticket SSO 联调 Demo 与配置

本文说明如何从集成平台工作台使用一次性 Ticket 登录外部业务系统。示例目标系统位于 `mock_target_sso`，使用 Flask 实现，可通过 `conda py312` 环境直接启动。

## 认证流程

```text
集成平台已登录用户点击工作台应用
  -> POST /api/me/apps/:id/sso-ticket
  -> 集成平台生成短时一次性 Ticket
  -> 浏览器跳转 mock_target_sso /sso/login?ssoCode=...&ticket=...
  -> mock_target_sso 服务端携带客户端密钥校验 Ticket
  -> POST /api/auth/sso/outbound/:ssoCode/verify
  -> 集成平台原子核销 Ticket 并返回用户身份
  -> mock_target_sso 建立自己的登录 Session
```

平台只在数据库保存 Ticket 的 SHA-256 摘要，不保存 Ticket 明文。Ticket 默认 30 秒过期，并且只能成功核销一次。

后端实现位于 `server/src/platform/sso/`，数据库升级由 `server/src/db/migrations/002_add_outbound_ticket_sso.sql` 在 API 启动时自动执行并记录到 `schema_migrations`。

## 前置条件

先启动集成平台，以下示例假定访问地址为：

```text
http://localhost:8088
```

如果 `.env` 中的 `WEB_PORT` 不是 `8088`，请同步修改本文中的平台地址。

## 创建内部访出配置

使用管理员账号进入：

```text
系统配置 -> 单点登录 -> 内部访出 -> 新建
```

填写以下属性：

| 属性 | 示例值 | 说明 |
| --- | --- | --- |
| 编码 | `mock_target` | 全局唯一；会作为跳转参数 `ssoCode`，并用于校验接口路径 |
| 名称 | `模拟目标系统` | 管理端显示名称 |
| 协议 | `Ticket` | 内部访出当前支持的执行协议 |
| 目标系统地址 | `http://localhost:9100/sso/login` | 平台签发 Ticket 后的浏览器跳转地址；已有查询参数会保留 |
| 客户端密钥 | `mock-target-secret-2026` | 目标系统调用校验接口时使用，至少 16 位；编辑时留空表示不更换 |
| Ticket 有效期 | `30` | 可配置为 5～300 秒 |
| 返回用户标识字段 | `userId` | 返回本地用户编码的 JSON 字段，支持 `data.userId` 这类点路径 |
| 优先级 | `1` | 配置列表排序 |
| 启用 | 开启 | 只有启用配置可以签发和核销 Ticket |
| 备注 | 可选 | 接入说明或负责人信息 |

保存后，密钥只保存为不可逆摘要，管理接口不会返回密钥明文。更换密钥后，目标系统必须同步更新，否则 Ticket 校验会返回 `401`。

## 关联工作台应用

进入 `工作台配置`，创建或编辑目标应用：

| 属性 | 示例值 | 说明 |
| --- | --- | --- |
| 名称 | `模拟目标系统` | 工作台磁贴名称 |
| 编码 | `mock_target_app` | 应用唯一编码 |
| 访问链接 | `http://localhost:9100` | 未关联 SSO 时使用的普通链接 |
| 内部访出 Ticket SSO | `模拟目标系统 (mock_target)` | 选择上一步创建的配置 |
| 指定用户 | 按需选择 | 限制工作台可见及 Ticket 签发权限；留空表示所有用户 |
| 显示 | 开启 | 必须开启才能从工作台签发 Ticket |

平台会在签发接口再次校验应用可见范围。用户即使直接调用接口，也不能为无权访问的应用签发 Ticket。

## 启动目标系统 Demo

目标系统与平台配置必须使用同一客户端密钥：

```bash
cd mock_target_sso
TARGET_CLIENT_SECRET='mock-target-secret-2026' \
MIDDLE_PLATFORM_VERIFY_URL='http://localhost:8088/api/auth/sso/outbound/mock_target/verify' \
conda run -n py312 python app.py
```

默认监听 `http://localhost:9100`。可用环境变量：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SSO_CODE` | `mock_target` | 必须与平台内部访出配置编码一致 |
| `TARGET_CLIENT_SECRET` | `mock-target-secret-2026` | 必须与平台配置的客户端密钥一致 |
| `MIDDLE_PLATFORM_VERIFY_URL` | `http://localhost:8088/api/auth/sso/outbound/mock_target/verify` | 平台 Ticket 校验接口 |
| `TARGET_SESSION_SECRET` | 开发示例值 | 目标系统 Flask Session 密钥，正式环境必须替换 |
| `SSO_VERIFY_TIMEOUT_SECONDS` | `5` | 调用平台校验接口的超时秒数 |
| `TARGET_HOST` | `0.0.0.0` | 监听地址 |
| `TARGET_PORT` | `9100` | 监听端口 |
| `TARGET_DEBUG` | `false` | 设为 `true` 时开启 Flask Debug，仅限本地开发 |

## 联调步骤

1. 登录 `http://localhost:8088`。
2. 确认内部访出配置和工作台应用均已启用且完成关联。
3. 返回工作台，点击“模拟目标系统”磁贴。
4. 平台打开新窗口并跳转到目标系统。
5. 页面显示“Ticket 已核销，目标系统会话建立成功”及当前用户信息。
6. 刷新目标系统页面，目标系统自己的 Session 会保持登录状态。

浏览器跳转地址形如：

```text
http://localhost:9100/sso/login?ssoCode=mock_target&ticket=<一次性凭证>
```

## Ticket 校验接口

目标系统必须从服务端调用，不能把客户端密钥放在浏览器代码中：

```http
POST /api/auth/sso/outbound/mock_target/verify
Authorization: Bearer mock-target-secret-2026
Content-Type: application/json

{"ticket":"<一次性凭证>"}
```

默认响应：

```json
{
  "userId": "admin",
  "userCode": "admin",
  "name": "超级管理员",
  "uuid": "00000000-0000-4000-8000-000000000001",
  "role": "super_admin"
}
```

若“返回用户标识字段”配置为 `data.userId`，用户编码会出现在 `data.userId`；`userCode`、`name`、`uuid` 和 `role` 仍保留在顶层。

## 运行测试

目标系统 Demo：

```bash
(cd mock_target_sso && conda run -n py312 python -m unittest -v)
```

平台 Ticket 工具测试：

```bash
(cd server && npm test)
```

测试覆盖目标系统 Session 建立、错误编码、校验失败、随机 Ticket、摘要存储、跳转参数和嵌套用户标识。

## 常见问题

### Ticket 或目标系统凭证无效

确认平台配置的客户端密钥与 `TARGET_CLIENT_SECRET` 完全一致，并确认内部访出配置已启用。密钥不会从管理端回显；忘记后请设置一个新密钥并同步更新目标系统。

### Ticket 无效、已过期或已使用

Ticket 只能使用一次，且默认 30 秒过期。请回到工作台重新点击应用，不要刷新带旧 Ticket 的 `/sso/login` 地址。

### 无法连接集成平台 Ticket 校验接口

确认 `MIDDLE_PLATFORM_VERIFY_URL` 是目标系统服务端可访问的地址。如果目标系统运行在 Docker 容器内，通常应将 `localhost` 替换为平台容器名或 `host.docker.internal`。

### 点击后仍打开普通链接

确认工作台应用的“内部访出 Ticket SSO”已经选择对应配置。仅创建内部访出配置不会自动改变应用的访问方式。

## 生产接入要求

- 平台和目标系统必须使用 HTTPS，避免 Ticket 和密钥在传输中泄露。
- 为每个目标系统使用独立的高强度客户端密钥，不要跨系统复用。
- 客户端密钥只允许保存在目标系统服务端的密钥管理或环境变量中。
- Ticket 校验成功后由目标系统建立自己的安全 Session，不要继续把 Ticket 当作会话凭证。
- 建议将 Ticket 有效期保持在 30～60 秒，并监控连续校验失败和异常流量。
