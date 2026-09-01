# SSO Ticket 联调 Demo 与配置

本文说明如何使用 `mock_sso` 模拟 OA，通过一次性 Ticket 登录集成平台。

## 1. 联调流程

```text
浏览器
  -> mock_sso（选择用户并签发 Ticket）
  -> 集成平台 /login?ssoCode=mock_oa&ticket=...
  -> 集成平台 API /api/auth/sso/mock_oa/exchange
  -> mock_sso /api/tickets/verify
  -> 集成平台创建会话并跳转工作台
```

Ticket 默认有效期为 10 秒，并且只能成功校验一次。

## 2. 前置条件

启动集成平台：

```bash
docker compose up -d --build
```

当前仓库 `.env` 的 Web 端口为 `8088`。如果使用 `.env.example` 或其他端口，请将本文中的 `8088` 替换为实际端口。

启动模拟 OA：

```bash
SSO_TARGET_URL='http://localhost:8088/login?ssoCode=mock_oa' \
conda run -n py312 python mock_sso/app.py
```

模拟 OA 地址为 `http://localhost:9000`。

## 3. 创建外部访入配置

使用管理员账号进入：

```text
系统配置 -> 单点登录 -> 外部访入 -> 新建
```

填写以下内容：

| 字段 | 推荐值 | 说明 |
| --- | --- | --- |
| 编码 | `mock_oa` | 必须与登录 URL 中的 `ssoCode` 一致，且全局唯一 |
| 名称 | `模拟 OA` | 配置显示名称 |
| 协议 | `Ticket` | 当前已实现的认证适配器 |
| 认证系统地址 | `http://localhost:9000` | 模拟 OA 页面地址 |
| 校验地址 | `http://host.docker.internal:9000/api/tickets/verify` | API 容器访问宿主机上的模拟 OA |
| 登录成功跳转地址 | `/` | 登录成功后进入工作台，也可填写 `/config/dashboard` |
| 用户标识字段 | `userId` | 对应校验接口返回 JSON 的 `userId` |
| 优先级 | `1` | 数值越小优先级越高 |
| 启用 | 开启 | 只有启用的配置才能交换 Ticket |

如果集成平台 API 不是运行在 Docker 容器中，校验地址改为：

```text
http://localhost:9000/api/tickets/verify
```

保存后，配置实际对应的后端接口为：

```text
POST /api/admin/sso/inbound
```

## 4. 准备门户用户

模拟 OA 默认提供以下用户：

```text
admin:Admin,demo:Demo,other:Other
```

集成平台必须存在相同 `code` 的本地用户。默认管理员 `admin` 已存在；如果要测试 `demo` 或 `other`，请先在“用户管理”中创建同编码用户，否则会返回 `403 用户尚未配置门户权限`。

也可以通过环境变量自定义模拟用户：

```bash
SSO_USERS='admin:管理员,alice:Alice' \
SSO_TARGET_URL='http://localhost:8088/login?ssoCode=mock_oa' \
conda run -n py312 python mock_sso/app.py
```

格式为逗号分隔的 `用户编码:显示名称`。

## 5. 发起登录测试

1. 打开 `http://localhost:9000`。
2. 选择一个已经在集成平台配置的用户。
3. 点击“发起单点登录”。
4. 模拟 OA 会跳转到集成平台登录地址，并附带一次性 `ticket`。
5. 集成平台服务端调用模拟 OA 的校验地址，校验成功后建立会话并进入工作台。

生成的跳转地址类似：

```text
http://localhost:8088/login?ssoCode=mock_oa&ticket=<一次性凭证>
```

模拟 OA 校验接口也可以单独检查：

```bash
curl http://localhost:9000/api/health
```

接口返回 `{"status":"ok",...}` 即表示模拟服务已启动。

## 6. 自动化测试

```bash
(cd mock_sso && conda run -n py312 python -m unittest -v)
```

测试覆盖 Ticket 签发、成功校验和同一 Ticket 重复校验失败。

## 7. 常见问题

### 未找到已启用的外部跳转访入配置

检查配置方向是否为“外部访入”、编码是否为 `mock_oa`，以及“启用”开关是否打开。

### 无法连接单点登录校验服务

Docker 部署时不能把校验地址写成 `localhost:9000`，因为这会指向 API 容器自身。macOS Docker Desktop 使用 `host.docker.internal`；本机直接运行 API 时才使用 `localhost`。

### 用户尚未配置门户权限

模拟 OA 返回的 `userId` 必须与集成平台用户的“账号”完全一致，注意大小写和空格。

### Ticket 无效、已过期或已使用

Ticket 默认 10 秒过期且只能使用一次。请从 `http://localhost:9000` 重新发起登录，不要刷新带有旧 Ticket 的地址。
