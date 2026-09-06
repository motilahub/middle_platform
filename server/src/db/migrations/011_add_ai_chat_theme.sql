ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS ai_chat_theme VARCHAR(20) NOT NULL DEFAULT 'light' CHECK (ai_chat_theme IN ('light', 'dark', 'nature')),
  ADD COLUMN IF NOT EXISTS ai_chat_effects BOOLEAN NOT NULL DEFAULT TRUE;
