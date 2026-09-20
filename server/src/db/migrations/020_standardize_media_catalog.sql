ALTER TABLE media_items
  ADD COLUMN content_category VARCHAR(10) NOT NULL DEFAULT 'general'
    CHECK (content_category IN ('general', 'anime')),
  ADD COLUMN release_date DATE,
  ADD COLUMN runtime_minutes INTEGER CHECK (runtime_minutes IS NULL OR runtime_minutes > 0),
  ADD COLUMN genres TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN countries TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN directors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN cast_members TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_media_items_category ON media_items(content_category, media_type);
