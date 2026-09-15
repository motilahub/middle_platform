ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS ai_chat_welcome VARCHAR(500) NOT NULL DEFAULT '你好，我是通用助手，有什么可以帮你？',
  ADD COLUMN IF NOT EXISTS ai_chat_first_prompt_count INTEGER NOT NULL DEFAULT 3 CHECK (ai_chat_first_prompt_count BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS ai_chat_max_rounds INTEGER NOT NULL DEFAULT 20 CHECK (ai_chat_max_rounds BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS ai_chat_followup_count INTEGER NOT NULL DEFAULT 3 CHECK (ai_chat_followup_count BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS ai_chat_robot_icon TEXT;

CREATE TABLE IF NOT EXISTS ai_agents (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  model_provider_id BIGINT REFERENCES model_providers(id) ON DELETE SET NULL,
  model_name VARCHAR(255),
  system_prompt TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS agent_id BIGINT REFERENCES ai_agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agents_enabled ON ai_agents(enabled, is_default, id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent ON ai_conversations(agent_id);

INSERT INTO ai_agents(code, name, description, system_prompt, enabled, is_default)
VALUES ('general-assistant', '通用助手', '处理日常问答、总结和分析', '你是一个可靠、清晰、简洁的通用助手。', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, resource, operation, name) VALUES
  ('platform.ai_agent.read', 'platform.ai_assistant', 'ai_agent', 'read', '查看智能体'),
  ('platform.ai_agent.create', 'platform.ai_assistant', 'ai_agent', 'create', '创建智能体'),
  ('platform.ai_agent.write', 'platform.ai_assistant', 'ai_agent', 'write', '修改智能体'),
  ('platform.ai_agent.unlink', 'platform.ai_assistant', 'ai_agent', 'unlink', '删除智能体')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_group_permissions(group_id, permission_id)
SELECT group_row.id, permission_row.id
FROM permission_groups group_row
JOIN permissions permission_row ON permission_row.code LIKE 'platform.ai_agent.%'
WHERE group_row.code = 'platform_admin'
ON CONFLICT DO NOTHING;
