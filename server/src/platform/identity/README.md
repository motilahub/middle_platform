# Identity

提供登录、退出、当前用户、管理员用户维护和权限组维护接口。权限组支持资源动作权限、继承组和用户多组归属；密码策略由公共安全策略注入。

## 自助注册与找回密码

`auth-service.js` 负责公开注册、邮箱验证码、重置密码及管理端 SMTP 配置；`auth-repository.js` 管理 PostgreSQL 中的验证码、限流和认证事件。迁移 `023_auth_recovery.sql` 为用户增加可空邮箱、可空手机号及会话版本，并新增 `auth_mail_settings`、`auth_verifications`、`auth_rate_events` 和 `auth_events`。升级不影响现有用户；旧用户需由管理员补录邮箱后才能通过邮箱找回密码。回退旧代码时可保留新增列与表，清理数据请单独创建迁移，不要直接删除用户邮箱。

注册默认关闭，管理员在“系统配置 -> 邮件与注册”填写 SMTP 并启用。当前平台尚未建立租户归属，新注册账号固定为 `user` 及 `platform_user` 组，不赋予管理权限或私有工作台应用访问权；在支持多租户公开注册前需要增加租户/邀请码绑定。密码遵循系统安全配置。新部署生产环境需设置 `INITIAL_ADMIN_PASSWORD`（至少 12 位）；已有管理员密码不被改动。

离线部署脚本首次安装会自动生成 `INITIAL_ADMIN_PASSWORD` 并写入部署目录的 `.env`（仅管理员可读），请登录后及时修改管理员密码。旧环境若仍使用默认管理员密码 `admin`，需立即更换；本次迁移不会自动修改已有账号密码。

验证码仅存 HMAC 摘要、5 分钟过期、错误最多 3 次、成功即消耗；同一用途和邮箱重新发送会覆盖旧码。60 秒内不能重发，同一邮箱每小时最多 5 次，单 IP 每小时最多 10 次；注册与重置操作另有限流。登录按账号和 IP 双重限制。计数存 PostgreSQL，可跨服务实例生效；限流事件保留约 2 天，`auth_events` 保留历史审计。日志只保存邮箱/账号的不可逆 HMAC 摘要，不保存验证码和密码。SMTP 密码使用 `AUTH_MAIL_ENCRYPTION_KEY`（缺省使用 `SESSION_SECRET`）加密，密钥更换前应重新配置 SMTP 密码。

公开接口：`GET /api/v1/auth/options`，`POST /api/v1/auth/send-code` (`purpose: register|reset`, `email`)，`POST /api/v1/auth/register`，`POST /api/v1/auth/reset-password`；受保护的配置和认证日志接口位于 `/api/v1/admin/auth-mail-settings`、`/api/v1/admin/auth-events`。所有写接口沿用 Session CSRF 校验。重置密码提升用户会话版本，旧会话在下一次 API 请求时失效。
