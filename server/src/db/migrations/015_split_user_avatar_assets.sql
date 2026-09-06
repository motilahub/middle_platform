ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_original TEXT,
  ADD COLUMN IF NOT EXISTS avatar_thumbnail TEXT;

UPDATE users
SET avatar_thumbnail = COALESCE(avatar_thumbnail, avatar)
WHERE avatar IS NOT NULL;
