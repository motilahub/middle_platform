# AI财务助手

## Docker 开发模式

日常开发使用以下命令启动。项目目录会以数据卷映射到容器 `/app`，修改本地 `src`、`index.html` 等文件后，容器内的 Vite 会自动热更新，无需重新构建镜像：

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d --build
```

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

生产部署前必须修改 `.env` 中的数据库密码与 `SESSION_SECRET`；HTTPS 部署时设置 `COOKIE_SECURE=true`。

## OA ticket

配置 `OA_VERIFY_URL` 后，OA 可跳转到：

```text
http://portal.example.com/login?ticket=一次性凭证
```

API 会 POST `{ "ticket": "..." }` 到 `OA_VERIFY_URL`，并使用响应中的 `userId` 匹配本地用户编号。
