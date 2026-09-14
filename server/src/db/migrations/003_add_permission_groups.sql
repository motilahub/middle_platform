CREATE TABLE IF NOT EXISTS permission_groups (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission_group_implied (
  group_id BIGINT NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  implied_group_id BIGINT NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, implied_group_id),
  CHECK (group_id <> implied_group_id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(160) NOT NULL UNIQUE,
  module VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  operation VARCHAR(40) NOT NULL CHECK (operation ~ '^[a-z][a-z0-9_]*$'),
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission_group_permissions (
  group_id BIGINT NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permission_groups (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_permission_group_permissions_permission ON permission_group_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_groups_group ON user_permission_groups(group_id);

INSERT INTO permission_groups(code, name, description) VALUES
  ('platform_admin', '平台管理员', '管理平台用户、工作台、系统设置和单点登录'),
  ('platform_user', '平台用户', '仅访问分配的工作台应用')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, resource, operation, name) VALUES
  ('platform.user.read', 'platform.identity', 'user', 'read', '查看用户'),
  ('platform.user.create', 'platform.identity', 'user', 'create', '创建用户'),
  ('platform.user.write', 'platform.identity', 'user', 'write', '修改用户'),
  ('platform.user.unlink', 'platform.identity', 'user', 'unlink', '删除用户'),
  ('platform.app.read', 'platform.workbench', 'app', 'read', '查看工作台应用'),
  ('platform.app.create', 'platform.workbench', 'app', 'create', '创建工作台应用'),
  ('platform.app.write', 'platform.workbench', 'app', 'write', '修改工作台应用'),
  ('platform.app.unlink', 'platform.workbench', 'app', 'unlink', '删除工作台应用'),
  ('platform.settings.read', 'platform.settings', 'settings', 'read', '查看系统设置'),
  ('platform.settings.write', 'platform.settings', 'settings', 'write', '修改系统设置'),
  ('platform.sso.read', 'platform.sso', 'sso', 'read', '查看单点登录配置'),
  ('platform.sso.create', 'platform.sso', 'sso', 'create', '创建单点登录配置'),
  ('platform.sso.write', 'platform.sso', 'sso', 'write', '修改单点登录配置'),
  ('platform.sso.unlink', 'platform.sso', 'sso', 'unlink', '删除单点登录配置')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_group_permissions(group_id, permission_id)
SELECT g.id, p.id
FROM permission_groups g CROSS JOIN permissions p
WHERE g.code = 'platform_admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_permission_groups(user_id, group_id)
SELECT u.id, g.id
FROM users u
JOIN permission_groups g ON g.code = CASE WHEN u.role IN ('super_admin', 'admin') THEN 'platform_admin' ELSE 'platform_user' END
ON CONFLICT DO NOTHING;
