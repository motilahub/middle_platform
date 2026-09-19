ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS total_episode_count INTEGER CHECK(total_episode_count IS NULL OR total_episode_count > 0),
  ADD COLUMN IF NOT EXISTS available_episode_count INTEGER CHECK(available_episode_count IS NULL OR available_episode_count > 0),
  ADD COLUMN IF NOT EXISTS episode_status VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK(episode_status IN ('updating','completed','unknown'));

UPDATE media_items
SET
  total_episode_count = CASE
    WHEN COALESCE(metadata->>'episodesInfo','') LIKE '%集全%' THEN episode_count
    ELSE total_episode_count
  END,
  available_episode_count = CASE
    WHEN COALESCE(metadata->>'episodesInfo','') LIKE '%更新至%集%'
      OR COALESCE(metadata->>'episodesInfo','') LIKE '%集全%'
    THEN episode_count
    ELSE available_episode_count
  END,
  episode_status = CASE
    WHEN COALESCE(metadata->>'episodesInfo','') LIKE '%集全%' THEN 'completed'
    WHEN COALESCE(metadata->>'episodesInfo','') LIKE '%更新至%集%' THEN 'updating'
    ELSE episode_status
  END
WHERE media_type='tv' AND episode_count IS NOT NULL;
