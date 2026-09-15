# 集成平台

一个面向企业内部系统的统一登录与工作台平台，提供用户认证、应用入口、权限控制、系统配置和单点登录管理。

## 核心能力

- **统一工作台**：以控制台分类和应用磁贴展示业务系统，支持分类优先级、应用排序、启停、图标、公共/私有可见性和指定用户访问范围。匿名访问工作台仅展示公共应用，登录用户可额外看到被授权的私有应用。
- **用户与权限**：采用 Odoo 风格的用户组与权限码模型，支持创建和维护权限组、权限组合及继承关系，并按资源的查看、创建、修改、删除权限控制菜单、路由和操作入口；用户管理支持头像上传、下载、删除，工作台、后台和 AI Chat Header 统一显示用户头像。
- **系统配置**：维护系统名称、浏览器 Title、Logo、登录页文字、页脚备案和工作台 Header。首次初始化默认显示 Header。
- **安全策略**：支持 API 访问频率限制、密码长度和字符组成策略；初始化默认每分钟 10000 次、最短密码 6 位且不强制字符组成；生产环境强制使用安全 Session 密钥。
- **单点登录**：已实现 Ticket 外部访入和内部访出，支持一次性凭证、用户权限校验、目标系统客户端密钥及工作台应用关联，并预留 OIDC、CAS、SAML 字段。
- **天影查**：无需登录即可按影视名称临时聚合全部搜索源，并按百度、夸克、UC、迅雷筛选结果；点击时按需解析并直达网盘。
- **安全会话**：使用 PostgreSQL 服务端 Session、HttpOnly Cookie、CSRF Token 和基础安全响应头。
- **模型供应商**：支持维护 OpenAI、DeepSeek、通义千问、智谱 AI、硅基流动、Moonshot AI 及自定义 OpenAI 兼容服务；API Key 加密保存，可测试连接并同步可用模型。
- **离线部署**：可将前端、API、PostgreSQL 镜像和部署脚本打包为一个无需源码的部署归档。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Ant Design |
| API | Node.js 22、Express 5 |
| 数据库 | PostgreSQL 15 |
| 图片处理 | Sharp |
| 运行方式 | Docker Compose、Nginx |

前端页面和业务模块位于 `src/`，后端 API 与业务模块位于 `server/src/`；React Router 负责前端路由组合，Express 模块注册器负责后端 API 装配。完整的前后端技术栈、模块边界和依赖规则请参阅 [`docs/系统架构.md`](docs/系统架构.md)。叫号系统目前处于方案设计阶段，暂不开发，设计边界和后续演进路线参阅 [`docs/叫号系统设计.md`](docs/叫号系统设计.md)。

## 界面概览

在本地已启动的环境中可访问 `http://localhost:8088` 预览。使用默认管理员账号登录后，系统由以下三部分组成：

生产环境由 Nginx 统一提供 HTTPS 入口，当前支持 `yangtiancheng.cn`、`proerp.cn`、`qupindou.cn` 及其 `www` 子域名访问平台首页。

- **登录页**：展示可配置的系统 Logo、系统名称和登录页副标题，提供账号、密码输入与页脚备案信息。
- **统一工作台**：默认显示顶部 Header，左侧为应用磁贴区域；Header 提供系统标识、控制台入口和当前登录身份。未登录访问 `/` 时可直接查看公共应用，右上角显示“登录”；登录后显示用户菜单，并可访问已授权私有应用。应用入口按优先级排列。
- **工作台配置**：管理员可维护应用入口、可见范围、访问方式和图标；编辑不同应用时会独立加载各自的图片配置。

“系统信息”中展示当前系统版本 `1.0.0`、GitHub 地址、作者“杨天成”和联系方式 `619453767@qq.com`。

![统一工作台：应用磁贴、控制台入口、当前用户与退出操作](docs/images/workbench.png)

- **管理控制台**：由 Header 的“控制台”进入。左侧集中工作台、工作台配置、用户管理和系统配置，手机端可通过左上角菜单按钮展开导航；系统配置中包含控制台分类和权限管理。所有管理列表统一提供关键词筛选、分页、多选和批量操作，表格使用紧凑统一行高与单双行底色。工作台配置以表格维护应用图标、编码、名称、控制台分类、优先级、显示状态和公共/私有可见性，并支持创建、批量删除、编辑和单项删除。

![工作台配置：应用入口管理、显示状态与编辑操作](docs/images/dashboard-config.png)

普通用户仅使用工作台应用入口；控制台菜单、路由和 CRUD 操作由用户权限组控制。工作台应用仍可按用户单独分配访问范围。页面中的 Logo、系统名称、Header 显示状态和备案信息均可在系统配置中维护。

权限模型采用四层结构：用户加入权限组，权限组授予资源级 `read/write/create/unlink` 权限，业务模块声明自己的权限码，记录范围规则作为后续扩展接入。后端接口是最终安全边界，前端权限仅用于菜单、路由和按钮展示。

## 快速开始

### Docker 开发模式

复制环境变量模板并启动服务：

```bash
cp .env.example .env
docker compose up -d --build
```

访问 `http://localhost:${WEB_PORT}`，复制模板后的默认端口为 `8080`。源码通过数据卷挂载，前端支持 Vite 热更新；API 修改后执行：

```bash
docker compose restart api
```

开发服务器会预热前端入口模块，并对 JavaScript、CSS 等静态模块启用 gzip 响应压缩，远程访问时无需切换启动方式或额外构建 Web 镜像。

查看状态或日志：

```bash
docker compose ps
docker compose logs -f web
```

停止服务：

```bash
docker compose down
```

数据库保存在 Docker 命名卷 `middle_platform_postgres_data` 中，容器重建不会删除数据。只有明确需要清空全部业务数据时才执行 `docker compose down -v`；API 路由、依赖或代码加载错误应修复代码并重建 API 镜像，不应通过删除数据库卷处理。

### 离线一键部署

在有 Docker 的构建机上生成包含全部运行镜像的归档：

```bash
./scripts/package-offline.sh
```

也可以指定版本号：

```bash
./scripts/package-offline.sh 20260901014
```

将 `release/middle_platform-<version>.tar.gz` 复制到目标服务器并执行：

```bash
tar -xzf middle_platform-<version>.tar.gz
cd middle_platform-<version>
./deploy.sh
```

脚本会加载 API、Web 和 PostgreSQL 镜像，首次运行时生成数据库密码和 Session 密钥，并启动全部服务。默认访问 `http://服务器IP:8080`。升级时保留原目录中的 `.env`，新包会自动切换镜像版本并保留数据库和上传文件卷。

## 默认账号与安全

- 初始管理员账号：`admin`
- 初始密码：`admin`
- 首次登录后请立即修改密码。
- 生产环境必须设置至少 32 位的 `SESSION_SECRET` 和强数据库密码。
- 可选设置 `MODEL_PROVIDER_ENCRYPTION_KEY` 作为模型供应商 API Key 的独立加密密钥；一旦已保存供应商配置，请保持该值不变。未设置时系统使用 `SESSION_SECRET`。
- 接入 HTTPS 后将 `COOKIE_SECURE=true`，并由入口网关负责 HTTP 到 HTTPS 跳转。

## 单点登录

外部系统使用已启用的 SSO 编码和一次性 Ticket 跳转：

```text
http://portal.example.com/login?ssoCode=mock_oa&ticket=<一次性凭证>
```

后端接口：

```text
POST /api/auth/sso/:ssoCode/exchange
Body: { "ticket": "..." }
```

Ticket 仅允许校验一次。校验结果中的用户标识字段支持任意层级的 JSON 点路径，例如 `userId`、`data.userId`。系统只允许匹配本地用户的 Ticket 登录，找不到本地用户时返回 `403`。

内部访出 Ticket 由平台签发，用户从工作台点击已关联的应用后跳转至目标系统；目标系统通过 Bearer 客户端密钥调用平台校验接口，Ticket 校验成功后立即失效。签发过程同时校验当前用户的应用可见权限。

```text
POST /api/me/apps/:appId/sso-ticket
POST /api/auth/sso/outbound/:ssoCode/verify
```

当前外部访入和内部访出的认证处理器均支持 `Ticket`；OIDC、CAS、SAML 可维护配置，但需要补充对应适配器后才能启用实际认证。

Ticket 模拟 OA 的完整配置、启动命令、联调流程和常见问题请参阅 [`docs/sso-ticket-inbound-demo.md`](docs/sso-ticket-inbound-demo.md)。

内部访出 Ticket 的属性配置、工作台关联、目标系统接口和联调流程请参阅 [`docs/sso-ticket-outbound-demo.md`](docs/sso-ticket-outbound-demo.md)。

## 模拟 SSO 服务

`mock_sso` 提供本地 OA 联调服务：

```bash
conda run -n py312 python mock_sso/app.py
```

访问 `http://localhost:9000`，选择模拟用户后发起登录。运行测试：

```bash
(cd mock_sso && conda run -n py312 python -m unittest -v)
```

`mock_target_sso` 提供被平台单点登录的轻量目标系统：

```bash
cd mock_target_sso
TARGET_CLIENT_SECRET='mock-target-secret-2026' \
MIDDLE_PLATFORM_VERIFY_URL='http://localhost:8088/api/auth/sso/outbound/mock_target/verify' \
conda run -n py312 python app.py
```

访问目标系统的推荐方式是从平台工作台点击已关联的应用。运行 Demo 测试：

```bash
(cd mock_target_sso && conda run -n py312 python -m unittest -v)
```

## 天影查

工作台内置“天影查”入口，对应 `/video-search`，页面及搜索、链接解析接口均无需登录即可访问。搜索时默认使用全部搜索源和全部网盘类型，当前接入“天查”搜索源。搜索结果仅保存在当前页面，不写入数据库；点击结果后先进入链接获取过渡页，解析成功后自动打开网盘，网盘访问与文件流量不经过平台服务器。

该业务模块默认通过 `ENABLED_MODULES=video-search` 启用，可通过以下环境变量调整搜索源地址、单次外部请求超时、每种网盘的结果上限和解析缓存时间：

```bash
PANSOU_BASE_URL=https://pansou.top
VIDEO_SEARCH_TIMEOUT_MS=12000
VIDEO_SEARCH_MAX_RESULTS=100
VIDEO_SEARCH_RESOLVE_CACHE_TTL_MS=300000
```

前端每页展示 20 条；成功链接在进程内临时缓存 5 分钟、最多 500 条，服务重启后自动清空且不会写入数据库。相同链接的并发解析会合并为一次第三方请求。搜索源接口属于第三方服务，部署方应在取得相应使用授权后启用，并自行确认搜索结果所指内容的使用权限。

## 项目结构

```text
src/                         React 前端
src/modules/videoSearch/     天影查页面、路由与客户端接口
src/platform/sso/            SSO 前端类型与 API
src/shared/                  前端共享请求能力
server/src/                  Express API 与数据库初始化
server/src/modules/videoSearch/ 天影查业务模块、搜索源与临时令牌
server/src/platform/sso/     SSO 后端平台模块
server/src/platform/identity/ 用户认证与用户管理
server/src/platform/workbench/ 工作台应用与图标管理
server/src/platform/settings/ 系统与安全配置
server/src/platform/model-providers/ 模型供应商配置与受控模型发现
server/src/modules/ai-assistant/ AI 对话会话、消息和流式回复模块
server/src/platform/health/   健康检查
server/src/platform/identity/permissions.js 用户组、权限码与权限解析
server/src/middleware/        认证、CSRF、限流和 HTTP 公共中间件
server/src/shared/           无业务归属的映射和公共工具
server/src/db/migrations/    顺序执行的数据库迁移
mock_sso/                    本地 SSO 联调服务
mock_target_sso/             内部访出目标系统联调服务
deployment/                  离线部署模板
scripts/package-offline.sh   离线镜像打包脚本
docker-compose.yaml          Docker 开发配置
Dockerfile.web               Web 生产镜像
server/Dockerfile            API 生产镜像
```

面向多行业扩展的 Monorepo 目录、模块边界、依赖方向、数据库迁移、多租户与权限规范请参阅 [`docs/系统架构.md`](docs/系统架构.md)。该文档是整个工程后续开发和模块接入的架构基准。

AI 对话设计与开发清单请参阅 [`docs/AI对话系统设计.md`](docs/AI对话系统设计.md)。页面使用 `@ant-design/x`，支持会话历史、发送按钮与 Enter 提交、SSE 流式回复、文件/图片附件、浏览器语音转文字、`@` 文件/知识库/智能体、`/` Skill 搜索、知识库创建和基础检索；候选面板打开时 Enter 仅确认当前候选，不会同时发送消息。欢迎区不显示机器人头像和填充背景，直接展示配置的欢迎词；推荐问题以三列紧凑卡片排列，卡片高度仅略高于小号单行文字，并在悬停时显示完整内容，移动端会收缩在聊天区域内避免横向溢出；附件、语音和发送操作保持垂直居中。模型供应商和具体模型由智能体封装，输入框内左下方提供紧凑的知识库与智能体选择，并支持后台配置欢迎词、随机起始话题、基于最近消息的上下文推荐问题、对话轮数、动态机器人图标、明亮/深色/自然主题、动态效果和 CHAT Header 显示开关；所有已登录页面右下角提供 AI Chat 悬浮入口。

平台上传的头像、系统 Logo、机器人图标和应用缩略图均经过浏览器及服务端压缩，页面展示资源控制在 100KB 以内，应用原图仅用于下载或后台存档。

图片资源采用原图与缩略图分离存储：页面列表、Header、头像和聊天消息只加载缩略图，下载与大图预览使用原图。AI Chat 支持停止当前流式生成，移动端输入字号不低于 16px，避免浏览器点击输入框时自动缩放页面。

基础配置的备案信息支持安全白名单 HTML（链接、加粗、换行等），内容以多行文本维护并在登录页、工作台和后台页脚渲染。

AI Chat 后续任务请参阅 [`docs/AI Chat待办事项.md`](docs/AI%20Chat待办事项.md)。管理控制台提供智能体配置和 AI Chat 配置，可维护模型绑定、System Prompt、欢迎词、推荐问题、对话轮数、机器人图标、主题和动态效果；工作台、分类、用户、权限组、SSO 和模型供应商列表已统一适配移动端：列保持最小可读宽度，手机端可横向滑动查看完整内容，中文不会被压缩成竖排。

管理控制台移动端标题区采用紧凑横向布局，标题、说明和操作按钮会在必要时换行，减少列表顶部无效留白。

基础配置、系统安全和 AI Chat 配置属于单例系统设置，明确采用整页表单维护；记录型新增和编辑表单统一使用右侧抽屉。图片维护统一支持点击上传、左上下载和右上删除。

当前代码已按该规范适配：前端使用 `src/app` 组合路由，后端使用 `server/src/bootstrap/module-registry.js` 注册平台和业务模块；身份、工作台、系统设置、健康检查和 SSO 已按平台边界拆分，`server/src/index.js` 仅负责基础设施启动与依赖装配。新增行业功能请从 `src/modules` 与 `server/src/modules` 的模块模板开始。

新客户端通过公共请求层访问 `/api/v1`；服务端暂时保留 `/api` 兼容路径。平台基础表和增量变更由 `server/src/db/migrations/` 顺序迁移，禁止在业务入口中新增建表 DDL。

业务模块通过 `ENABLED_MODULES` 按需加载，例如 `ENABLED_MODULES=video-search,education.sunny-class,finance`。模块放在 `server/src/modules/<module-key>/`，由 `server/src/bootstrap/module-loader.js` 发现、校验依赖、执行迁移并注册路由；普通业务模块未配置时不会加载，声明 `enabledByDefault` 的平台通用模块会默认加载，也可以通过配置显式加载其他模块。

业务模块可以在 manifest 中声明 `permissions`，模块加载阶段会注册权限码。例如 `education.student.read`、`education.student.write`；路由通过 `dependencies.requirePermission(code)` 校验，后续记录规则应由模块提供服务端 Domain 构造器。

## 常用命令

```bash
npm run build                # 前端类型检查与生产构建
(cd server && npm test)      # 后端模块与 SSO 单元测试
docker compose up -d         # 启动开发环境
docker compose down          # 停止开发环境
```

## 许可证

本项目许可证及使用范围以仓库发布方的正式声明为准。
