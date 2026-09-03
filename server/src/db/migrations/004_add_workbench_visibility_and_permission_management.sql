ALTER TABLE dashboard_apps
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));

UPDATE dashboard_apps SET visibility = 'public' WHERE visibility IS NULL;

ALTER TABLE system_settings
  ALTER COLUMN api_rate_limit_per_minute SET DEFAULT 10000,
  ALTER COLUMN password_min_length SET DEFAULT 6,
  ALTER COLUMN password_require_uppercase SET DEFAULT FALSE,
  ALTER COLUMN password_require_lowercase SET DEFAULT FALSE,
  ALTER COLUMN password_require_special SET DEFAULT FALSE,
  ALTER COLUMN password_require_number SET DEFAULT FALSE;

INSERT INTO permissions(code, module, resource, operation, name) VALUES
  ('platform.permission.read', 'platform.identity', 'permission_group', 'read', '查看权限组'),
  ('platform.permission.create', 'platform.identity', 'permission_group', 'create', '创建权限组'),
  ('platform.permission.write', 'platform.identity', 'permission_group', 'write', '修改权限组'),
  ('platform.permission.unlink', 'platform.identity', 'permission_group', 'unlink', '删除权限组')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_group_permissions(group_id, permission_id)
SELECT group_row.id, permission_row.id
FROM permission_groups group_row
JOIN permissions permission_row ON permission_row.code LIKE 'platform.permission.%'
WHERE group_row.code = 'platform_admin'
ON CONFLICT DO NOTHING;
