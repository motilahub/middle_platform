# AI财务助手

## 系统介绍

AI财务助手提供登录认证、工作台应用入口、应用可见范围、用户管理和单点登录配置管理。管理员可在“系统配置 → 基础配置”维护系统 Logo、系统标题、浏览器 Title/Title Logo、登录页文字和页脚备案信息；维护表单在桌面端采用两列布局，移动端收为单列。“控制台管理”中的“显示 Header”开关可控制工作台是否显示顶部 Header，Header 左侧展示系统 Logo 和系统名称，右侧提供控制台、当前用户和退出操作区，默认不显示；字号、间距与后台管理 Header 保持一致。后台管理顶部左侧提供侧栏收起/展开按钮，收起后保留系统 Logo 与菜单图标。后台管理统一通过顶部“控制台”入口进入工作台配置，页面内不再提供重复入口。“系统配置 → 系统安全”可维护接口频率限制和用户密码强度：接口默认按来源 IP 在滚动 60 秒内限制 30 次请求，超过后返回 HTTP 429；密码策略可设置最小长度及大写字母、小写字母、数字、特殊符号要求，创建用户或修改密码时立即生效。在“系统配置 → 单点登录”下维护两类配置：

- **外部访入**：配置 OA 或其他系统如何登录进入本系统。
- **内部访出**：配置本系统如何跳转并登录到其他业务系统。

两类配置均支持新建、编辑、删除、批量删除、全选、分页和启用/停用。列表会展示系统地址和校验地址；编辑抽屉会在打开后回填记录的协议字段。配置表单提供编码、名称、协议（OIDC/CAS/Ticket/SAML）、系统地址、校验地址、授权地址、回调地址、Issuer、Client ID、用户标识字段、优先级和备注等通用字段。实际 SSO 跳转接口根据 OA 和目标系统的协议再行接入。

## Docker 开发模式

日常开发使用以下命令启动。项目目录会以数据卷映射到容器 `/app`，修改本地 `src`、`index.html` 等文件后，容器内的 Vite 会自动热更新，无需重新构建镜像：

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d --build
```

`.gitignore` 已排除依赖目录、构建产物、环境变量、本地日志、Python 缓存和 macOS/编辑器元数据；`.env.example` 保留在版本控制中作为配置模板。

访问 `http://localhost:8080`。宿主机不使用 5173 端口，5173 仅是容器内 Vite 端口并映射为宿主机 8080。停止服务：

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml down
```

开发模式下不要只执行 `docker compose restart` 来更新代码；`restart` 只重启容器，源码是否生效取决于 `docker-compose.dev.yaml` 的本地目录挂载。首次启动或依赖变更时使用 `up -d --build`。

开发模式需要重启容器时：

```bash
# 重启全部服务
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml restart

# 只重启前端
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml restart web
```

不建议直接使用不带 `-f` 的 `docker-compose restart`：它不会加载开发覆盖配置，也不会重新构建镜像。开发模式应始终带上两个 `-f`；生产模式只使用基础配置时，才可以直接执行 `docker compose restart`。

查看状态和日志：

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml ps
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f web
```

## Docker 生产模式

```bash
cp .env.example .env
docker compose up -d --build
```

访问 `http://localhost:8080`。生产模式的 `web` 服务使用 Nginx 提供构建后的静态文件，不挂载本地源码；修改前端代码后必须重新执行 `docker compose up -d --build`，单纯重启不会更新页面。

登录初始账号由后端初始化逻辑创建，默认账号和密码均为 `admin`。登录页不显示该提示，部署后请及时修改密码。

数据保存在 `postgres_data` 卷，上传图片保存在 `upload_data` 卷。普通的容器重建不会清空数据。

生产部署前必须修改 `.env` 中的数据库密码与至少 32 位的随机 `SESSION_SECRET`；生产模式若未提供有效的 `SESSION_SECRET`，API 将拒绝启动。暂未部署 HTTPS 时保持 `COOKIE_SECURE=false`；接入 HTTPS 后必须设置为 `true`，并由入口网关完成 HTTP 跳转 HTTPS。

当前登录采用 PostgreSQL 服务端 Session：浏览器仅保存 `HttpOnly`、`SameSite=Lax` 的会话 ID，登录及 SSO 成功后会重建 Session。所有会修改数据的 API 均要求携带同源 CSRF Token，API 和生产 Nginx 均发送基础安全响应头。

## 外部访入

外部系统应跳转到以下格式的地址；`ssoCode` 必须是“系统配置 → 单点登录 → 外部访入”中已启用的配置编码：

```text
http://portal.example.com/login?ssoCode=配置编码&ticket=一次性凭证
```

前端会将 ticket 通过 `POST /api/auth/sso/:ssoCode/exchange` 发送至本系统。携带 ticket 的访问会先清除浏览器中的旧会话；同一个 ticket 仅发起一次校验，校验失败后停留在登录页。后端仅查询对应的已启用入站配置，POST `{ "ticket": "..." }` 至其“校验地址”，按“用户标识字段”从响应中获取用户编号，并匹配本地用户。该字段支持任意层级的 JSON 点路径，例如 `userId`、`data.userId`、`data.result.account.userId`。找不到本地用户时返回 `403`，不会创建会话。成功后会跳转至配置的“登录成功跳转地址”；推荐填写系统内相对路径，例如 `/config/dashboard`，也支持同源完整地址。非同源地址会回退至工作台 `/`。

当前认证处理器已实现 `Ticket` 协议；OIDC、CAS、SAML 可先维护配置，但需要按目标系统协议补充各自的认证适配器后才能启用实际登录。

表单会按协议显示字段：`Ticket` 显示校验地址与登录成功跳转地址；`CAS` 显示 Ticket 校验地址和服务回调地址；`OIDC` 显示 Issuer、授权地址、Token/用户信息地址、回调地址与 Client ID；`SAML` 显示 IdP Issuer、SAML 元数据/校验地址与断言消费地址（ACS）。切换协议时，原协议特有字段不会随新协议提交。

## 模拟 OA SSO 服务

工程内的 `mock_sso` 是一个基于 Conda `py312` 环境的本地模拟 OA 服务，用于联调“外部访入”。它提供浏览器发起入口、一次性 ticket 和校验回调接口：

- `GET /`：选择模拟用户后发起单点登录，浏览器跳转至 `http://localhost:8080/login?ssoCode=mock_oa&ticket=...`。
- `POST /api/tickets/verify`：接收 `{ "ticket": "..." }`，返回 `{ "userId": "admin", "name": "Admin" }`；ticket 默认 10 秒有效，成功验证后立即失效。
- `GET /api/health`：健康检查。

启动服务：

```bash
conda run -n py312 python mock_sso/app.py
```

浏览器访问 `http://localhost:9000`，选择用户后即可跳转到本系统。模拟服务默认提供 `admin:Admin`、`demo:Demo`、`other:Other` 三个用户；通过 `SSO_USERS` 可覆盖：

```bash
SSO_USERS='admin:Admin,alice:Alice' conda run -n py312 python mock_sso/app.py
```

在“外部访入”中新建以下联调配置：编码 `mock_oa`，协议 `Ticket`，认证系统地址 `http://host.docker.internal:9000`，校验地址 `http://host.docker.internal:9000/api/tickets/verify`，登录成功跳转地址 `/config/dashboard`，用户标识字段 `userId`。macOS Docker Desktop 中 `host.docker.internal` 可从容器访问宿主机的 9000 服务。

联调权限预期：本地 `admin` 为超级管理员，可登录并访问系统配置；本地 `demo` 为普通用户，可登录工作台但访问系统配置会被拦截；远端 `other` 不配置本地用户，登录会被 `403` 拦截。服务参数：`SSO_TARGET_URL`（目标登录页）、`SSO_TICKET_TTL_SECONDS`（有效期秒数）、`SSO_HOST`、`SSO_PORT`。运行模拟服务的单元测试：

```bash
(cd mock_sso && conda run -n py312 python -m unittest -v)
```
