CREATE TABLE IF NOT EXISTS model_providers (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  vendor VARCHAR(40) NOT NULL CHECK (vendor IN ('openai','deepseek','qwen','zhipu','siliconflow','moonshot','custom')),
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_model VARCHAR(255),
  remark VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_providers_enabled ON model_providers(enabled);

INSERT INTO permissions(code, module, resource, operation, name) VALUES
  ('platform.model_provider.read', 'platform.model_providers', 'model_provider', 'read', '查看模型供应商'),
  ('platform.model_provider.create', 'platform.model_providers', 'model_provider', 'create', '创建模型供应商'),
  ('platform.model_provider.write', 'platform.model_providers', 'model_provider', 'write', '修改模型供应商'),
  ('platform.model_provider.unlink', 'platform.model_providers', 'model_provider', 'unlink', '删除模型供应商')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_group_permissions(group_id, permission_id)
SELECT group_row.id, permission_row.id
FROM permission_groups group_row
JOIN permissions permission_row ON permission_row.code LIKE 'platform.model_provider.%'
WHERE group_row.code = 'platform_admin'
ON CONFLICT DO NOTHING;
