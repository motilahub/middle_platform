ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS added_manually BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_media_items_visible_title
  ON media_items(media_type, added_manually, title);
