# Motila

一个面向企业内部系统的统一登录与工作台平台，提供用户认证、应用入口、权限控制、系统配置和单点登录管理。

## 核心能力

- **统一工作台**：以控制台分类和应用磁贴展示业务系统，支持分类优先级、应用排序、启停、图标、公共/私有可见性和指定用户访问范围。匿名访问工作台仅展示公共应用，登录用户可额外看到被授权的私有应用。
- **用户与权限**：采用 Odoo 风格的用户组与权限码模型，支持创建和维护权限组、权限组合及继承关系，并按资源的查看、创建、修改、删除权限控制菜单、路由和操作入口；用户管理支持头像上传、下载、删除，工作台、后台和 AI Chat Header 统一显示用户头像。
- **系统配置**：维护系统名称、浏览器 Title、Logo、登录页文字、页脚备案和工作台 Header。首次初始化默认显示 Header。
- **安全策略**：支持 API 访问频率限制、密码长度和字符组成策略；初始化默认每分钟 10000 次、最短密码 6 位且不强制字符组成；生产环境强制使用安全 Session 密钥。
- **单点登录**：已实现 Ticket 外部访入和内部访出，支持一次性凭证、用户权限校验、目标系统客户端密钥及工作台应用关联，并预留 OIDC、CAS、SAML 字段。
- **天影查**：无需登录即可按影视名称临时聚合全部搜索源，并按百度、夸克、UC、迅雷筛选结果；点击时按需解析并直达网盘。
- **影视库**：管理员按需同步豆瓣电影 Top250 与电视剧榜单，系统按豆瓣 ID 去重并通过带缓存的受限代理稳定展示海报；用户可查看影片、选择集数，在详情页点击在线播放或集数后通过纯黑背景浮窗播放暴风、1080影视、新浪、牛牛、非凡和360等独立线路，也可单独检索网盘资源。
- **视频播放器**：支持 HLS（M3U8）、MP4 和 WebM 等媒体直链播放，播放中 5 秒无操作会自动收起上下工具栏和线路面板；移动端长按画面可无提示临时 2 倍速播放，并通过画面左、右半区纵向滑动调节显示亮度和音量；兼容浏览器支持时，全屏可锁定当前屏幕方向并屏蔽误触。影视详情页在画面左上角无底色显示片名与当前集数（电影仅显示片名），并可从画面右侧切换播放线路及上下集；独立播放器继续支持手动输入地址，播放流量均由浏览器直接访问视频源站，不经过平台 API 转发。
- **基础网络投屏**：播放器可通过浏览器 Presentation API 将当前播放页发送到同一网络中的兼容接收设备；接收设备直接请求媒体源，不经过平台代理。
- **统一页面导航**：工作台、天影查和视频播放器复用系统 Header、控制台入口、用户菜单与 Footer；投屏接收页保持纯播放模式。
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
- **工作台配置**：管理员可维护应用入口、可见范围、访问方式、打开方式和图标；应用默认在当前页打开，只有配置为“新页签”时才创建新页签，编辑不同应用时会独立加载各自的图片配置。

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
VIDEO_SEARCH_TIMEOUT_MS=30000
VIDEO_SEARCH_MAX_RESULTS=100
VIDEO_SEARCH_RESOLVE_CACHE_TTL_MS=300000
```

前端每页展示 20 条；成功链接在进程内临时缓存 5 分钟、最多 500 条，服务重启后自动清空且不会写入数据库。相同链接的并发解析会合并为一次第三方请求。搜索源接口属于第三方服务，部署方应在取得相应使用授权后启用，并自行确认搜索结果所指内容的使用权限。

## 影视库

访问 `/media-library` 查看电影和电视剧榜单，并可直接按类型及影视名称筛选；影视列表固定每页显示 20 条，切换类型或重新搜索时自动回到第一页。影视库和详情页支持在页头切换日间/黑夜模式，选择会保存在当前浏览器中。前台不显示标题和同步工具栏，榜单同步集中在控制台“影视库管理”。豆瓣暂未提供评分时统一显示 `0.0`，评分数字在窄屏卡片中保持完整显示。控制台“影视库管理”提供手工新增、编辑、单条删除和批量删除；“资源添加”并行搜索豆瓣与 TMDB 的电影、电视剧和动漫，跨来源按名称排序并每页显示 20 条，展示来源标签及每个来源的错误状态，由管理员选择入库条目。豆瓣模糊搜索读取搜索页前两页，移动端影视搜索和旧联想接口作为回退；TMDB 在存在后续结果时读取前两页。入库时后端按所选来源及 ID 重新获取详情，不信任前端搜索结果。管理功能使用 `media.library.read/create/write/unlink` 细分权限，并兼容已有的 `media.library.manage` 权限；具有 `media.library.sync` 权限的用户默认分别读取电影 `movie_top250` 和电视剧 `tv_hot` 榜单最多 5 页。

所有写入均按 `(source, external_id)` 唯一键执行 UPSERT；TMDB 条目以 `('tmdb', TMDB ID)` 唯一标识，与数字相同的豆瓣 ID 不冲突；不同来源的同名影视保持独立，由管理员选定入库。电影、电视剧和动漫采用统一资料字段（动漫为独立内容分类，保留电影/剧集的播放形态）：上映日期、时长、类型、地区、语言、导演、演员及原名、评分、海报、简介、剧集进度；可在编辑抽屉维护，管理列表可筛选动漫。手工加入的影片会保留 `added_manually` 标记，后续榜单同步不会将其从影视库隐藏。本次未进入榜单且未手工加入的旧记录仅取消榜单标记，不直接删除。

电视剧分别保存计划总集数、当前已更新集数和更新状态：豆瓣详情的 `episodes_count` 作为总集数，`episodes_info` 中的“更新至 N 集”作为当前可用集数，“N 集全”标记为已完结。详情页按计划总集数显示选集，每页固定两行，列数随可用宽度调整，超出一页可翻页；未更新的集数也可点击并尝试搜索播放资源，但不能超过计划总集数；只有总集数而无法取得更新进度时，页面显示“共 N 集”。影视库的类型、关键词和页码保存在地址栏，从搜索结果进入详情后点击“返回影视库”可恢复原筛选与页码。同步榜单时会同时刷新电视剧详情，服务运行期间默认每 6 小时再次读取豆瓣详情，自动更新连载进度。

```bash
DOUBAN_BASE_URL=https://m.douban.com
DOUBAN_MOVIE_COLLECTION=movie_top250
DOUBAN_TV_COLLECTION=tv_hot
DOUBAN_TIMEOUT_MS=12000
TMDB_ACCESS_TOKEN=
TMDB_API_KEY=
TMDB_PROXY_URL=
TMDB_TIMEOUT_MS=12000
MEDIA_LIBRARY_SYNC_LIMIT=250
MEDIA_LIBRARY_PROGRESS_SYNC_INTERVAL_MS=21600000
```

`MEDIA_LIBRARY_SYNC_LIMIT` 同时控制电影和电视剧的榜单同步数量，默认及最大值均为 250；Provider 每页读取 50 条，最多自动读取 5 页，并在榜单实际数据提前取完时停止。`MEDIA_LIBRARY_PROGRESS_SYNC_INTERVAL_MS` 可调整自动刷新周期，最小为 5 分钟；设置为 `0` 可关闭定时刷新。

TMDB 搜索使用官方 `/3/search/multi`，详情读取 `/3/movie/{id}` 或 `/3/tv/{id}`，中文资料及演职员随详情一起读取。部署时在 API 端配置 `TMDB_ACCESS_TOKEN`（推荐）或 `TMDB_API_KEY`；未配置时豆瓣搜索仍可用，管理页会提示 TMDB 未配置。服务器无法直连 TMDB 时，可配置 `TMDB_PROXY_URL` 使用 HTTP(S) 或 SOCKS 代理，例如 `socks5h://host.docker.internal:1080`（`socks5h` 会通过代理解析域名）；TMDB API 和 TMDB 海报请求会固定使用该代理，不受进程的其他代理变量影响。Docker Compose 已提供 `host.docker.internal` 到宿主机网关的解析。若宿主机代理只监听 `127.0.0.1:1080`，Linux 部署可设置 `COMPOSE_PROFILES=tmdb-proxy` 并将 `TMDB_PROXY_URL` 设为 `socks5h://host.docker.internal:11080`，启用仅接受 Docker 私网连接的桥接服务；也可直接让宿主机代理监听 Docker 网关。凭据不返回前端，海报只通过受限的豆瓣/TMDB 图片代理获取。

电影可直接选择“在线播放”或“网盘资源”；电视剧点击可用集数后会立即搜索并播放对应剧集，无需再次点击“在线播放”。网盘资源始终只用影视名称检索，抽屉标题也只显示影视名称，不拼接电视剧集数；抽屉内可按百度、夸克、UC、迅雷筛选，并可即时搜索资源名称、搜索源或来源线路。在线播放通过 `server/src/modules/mediaLibrary/playableSearch.js` 的 Provider 协议扩展，默认依次查询暴风资源、1080影视、新浪资源、牛牛资源、非凡资源和360资源。标准 MacCMS 来源按完全相同片名、年份、播放器标识和集数筛选，只接受无需专用解析器的 HTTPS M3U8；牛牛先通过官网名称建议接口定位完全匹配的资源 ID，再从 `nnm3u8` 接口读取详情；两类来源在已标注集数时都不会用列表位置回退到其他集。各 Provider 独立查询，一个来源无匹配或不可用不会影响其他来源；详情页默认播放首个结果；不同播放地址分别作为备选线路，编号和简短来源名在播放器右侧可自动收起的面板中展示，切换线路后也会自动播放。来源 CDN 若针对当前浏览器返回 CORS、403、区域限制或失效地址，播放器会从本次列表移除该线路并自动加载下一条可用线路。媒体清单和分片均由用户浏览器直连源站，不经过平台 API。

六个播放源默认启用，可分别关闭、切换 API 地址或调整请求超时：

```bash
BAOFENG_PLAYABLE_ENABLED=true
BAOFENG_API_URL=https://bfzyapi.com/api.php/provide/vod/
BAOFENG_TIMEOUT_MS=12000
YZY1080_PLAYABLE_ENABLED=true
YZY1080_API_URL=https://api.yyzy-tv.vip/inc/apijson.php
YZY1080_TIMEOUT_MS=12000
XINLANG_PLAYABLE_ENABLED=true
XINLANG_API_URL=https://api.xinlangapi.com/xinlangapi.php/provide/vod/from/xlm3u8/
XINLANG_TIMEOUT_MS=12000
NIUNIU_PLAYABLE_ENABLED=true
NIUNIU_SITE_URL=https://niuniuzy4.com
NIUNIU_API_URL=https://api.niuniuzy.me/api.php/provide/vod/from/nnm3u8/at/json
NIUNIU_TIMEOUT_MS=12000
FEIFAN_PLAYABLE_ENABLED=true
FEIFAN_API_URL=https://ffzy5.tv/api.php/provide/vod/
FEIFAN_TIMEOUT_MS=12000
ZY360_PLAYABLE_ENABLED=true
ZY360_API_URL=https://360zyzz.com/api.php/provide/vod/
ZY360_TIMEOUT_MS=12000
```

非凡资源只使用 `ffm3u8` 线路，360资源只使用 `360zy` 线路；其他解析页、HTTP 地址和非 HLS 地址不会加入播放列表。所给其他站点目前未能同时验证公开可用的 HTTPS JSON 采集接口与直连 HLS 线路（无尽接口返回 403、麒麟接口要求 IP 授权等），因此未默认接入。外部接口可能随时调整或限流，需以实际部署环境测试为准。

标准采集 Provider 只返回无需平台代理、Cookie、Referer、专用解析器或 DRM 的 HTTPS HLS，并交由现有播放器直连。豆瓣及其他外部数据和媒体来源应在符合对方服务条款、版权和授权要求的前提下启用；部署方应自行确认暴风、1080影视、新浪、牛牛、非凡、360及具体影片的接入授权。

## 视频播放器

访问 `/video-player` 可输入媒体直链播放视频。播放器在自动模式下根据地址识别 HLS 与普通媒体文件，也可手动选择 HLS 或直连模式。HLS 在支持原生播放的浏览器中使用原生能力，其余现代浏览器按需加载 `hls.js`。

也可以使用查询参数预填播放地址和标题：

```text
/video-player?src=https%3A%2F%2Fcdn.example.com%2Fmovie.m3u8&title=示例视频
```

媒体清单、分片和文件均由用户浏览器直接请求源站。HLS 源站必须允许浏览器跨域读取播放列表与分片，HTTPS 页面不能播放 HTTP 媒体；需要服务端代加 Cookie、Referer 或代理分片的播放源不属于直连模式。仅应播放已取得合法授权的内容。

画面右上角的分享和投屏按钮均为无底色小图标；分享菜单与播放源列表均采用紧凑的深色半透明样式，支持调用浏览器/系统分享菜单（设备支持时）或复制当前页面链接，影视详情链接包含当前选集。播放源在右侧通过窄箭头展开，选中线路或闲置后收起。

独立播放器输入媒体地址并点击“加载”后会自动开始播放；影视详情页点击“在线播放”或电视剧集数后则以居中的浮窗打开同一播放器，关闭浮窗即停止播放。浮窗外背景纯黑，片名、集数、分享和投屏在画面顶部对齐；电视剧的“在线播放”和“网盘资源”操作位于选集上方。播放线路从画面右侧展开，显示“线路1·暴风”等简短名称，面板选择后立即收起，闲置后也会自动收起。电视剧播放器的播放按钮两侧可切换上下集，第一集和最后一集禁用对应按钮；当前集播完后只在下一集有资源时继续播放，否则停留在已播完的当前集。若浏览器策略阻止自动播放，则保留为可播放状态并提示手动播放。独立播放器加载后标题区只显示视频名称，不显示固定的“视频播放器”文字和图标；名称优先取页面 `title` 参数，其次取媒体链接中的名称参数或文件名，无法识别名称时隐藏标题区。播放器标题区不额外显示播放状态标签，加载、错误和投屏状态直接在画面区域反馈。视频播放时控制按钮显示暂停图标，暂停时画面中央显示大号圆形播放图标，继续播放后隐藏；单击视频画面可切换播放和暂停，双击可进入或退出全屏。全屏按钮会跟随浏览器的真实全屏状态切换为退出全屏图标，再次点击即可退出；桌面浏览器使用标准全屏并兼容旧版 Safari 的 WebKit 全屏，iPhone/iPad Safari 使用视频原生全屏。全屏播放时鼠标静止约 2.5 秒后顶部操作区、底部进度控制栏和鼠标会缓慢隐藏，移动鼠标、触摸或键盘操作后立即恢复，暂停和操作控件期间保持显示。播放器“投屏”按钮在支持 Presentation API 的浏览器中打开同源接收页，连接成功后本地播放器暂停并显示“视频已投屏”；Safari 则打开系统 AirPlay 设备选择器，并监听无线播放状态切换投屏图标，退出时再次打开选择器并选回当前设备。播放器底部控制条依次提供播放/暂停、带缓存区间的进度、音量、播放速度和全屏操作；音量使用实心扬声器图标，点击后向上展开紧凑的竖向滑杆，可在 `0-100` 范围连续拖动，全屏时也会显示在播放器内部；播放速度以无边框、无箭头的 `1x` 文本控件显示，Presentation API 投屏期间隐藏本地播放控制。浏览器和接收设备需位于允许设备发现的同一网络；Safari 的 AirPlay 需要兼容的 Apple TV、电视或 Mac。临时签名地址、需要 Cookie/Referer 的地址和受 DRM 保护的内容可能无法在接收设备上播放。

浮窗外的黑色区域即使被误触也不会关闭播放器；需要结束播放时点击浮窗右上角的关闭按钮，或按 Esc。

视频暂停时画面中央显示圆圈内的播放图标，底部控制按钮仍按播放状态在播放和暂停图标之间切换。

切换同一影片或剧集的播放线路时，新线路就绪后尝试从原播放位置继续；切换剧集仍从头播放。线路展开入口位于右侧投屏按钮下方，箭头按钮底色约 90% 透明。移动端播放器随设备旋转适配横竖屏；支持方向锁定的触屏浏览器可点击横屏按钮进入全屏并锁定横屏，再次点击恢复自动旋转，退出全屏也会解锁。iPhone/iPad Safari 使用系统原生全屏和自动旋转，不强制旋转页面。

电视剧的“在线播放”和“网盘资源”按钮组在窄屏下与选集网格的实际列宽对齐，不会超出下方集数的右边缘。

## 项目结构

```text
src/                         React 前端
src/modules/mediaLibrary/    豆瓣榜单影视库、详情、选集与资源抽屉
src/modules/videoPlayer/     HLS 与普通媒体直连播放器
src/modules/videoSearch/     天影查页面、路由与客户端接口
src/platform/sso/            SSO 前端类型与 API
src/shared/                  前端共享请求能力
server/src/                  Express API 与数据库初始化
server/src/modules/mediaLibrary/ 影视榜单同步、持久化与在线播放 Provider
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

## 工程体积与产物管理

仓库仅保存源码、锁定文件、配置模板和必要文档，不提交可重新生成的依赖与构建产物。前端依赖、服务端依赖和生产构建分别通过以下命令恢复：

```bash
npm ci
(cd server && npm ci)
npm run build
```

`node_modules/`、`server/node_modules/`、`dist/`、TypeScript 构建缓存、运行时上传目录和离线部署归档均由忽略规则排除。源码交付应使用 Git 克隆或 Git 归档，不应直接打包包含 `.git/`、依赖目录和本地 `.env` 的整个工作目录。Docker 构建上下文也排除了依赖、测试缓存、文档和运行时数据，依赖统一在镜像构建阶段按锁定文件安装。

## 许可证

本项目许可证及使用范围以仓库发布方的正式声明为准。
