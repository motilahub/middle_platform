ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS system_logo_original TEXT,
  ADD COLUMN IF NOT EXISTS title_logo_original TEXT,
  ADD COLUMN IF NOT EXISTS ai_chat_robot_icon_original TEXT;

UPDATE system_settings SET
  system_logo_original = COALESCE(system_logo_original, system_logo),
  title_logo_original = COALESCE(title_logo_original, title_logo),
  ai_chat_robot_icon_original = COALESCE(ai_chat_robot_icon_original, ai_chat_robot_icon);
