ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS pan_search_url TEXT NOT NULL DEFAULT 'http://localhost:8888/api/search';
