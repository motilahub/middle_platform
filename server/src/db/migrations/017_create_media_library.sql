CREATE TABLE IF NOT EXISTS media_items (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(30) NOT NULL DEFAULT 'douban',
  external_id VARCHAR(80) NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK(media_type IN ('movie','tv')),
  title VARCHAR(300) NOT NULL,
  original_title VARCHAR(300),
  year INTEGER,
  poster_url TEXT,
  rating NUMERIC(3,1),
  ranking INTEGER,
  summary TEXT,
  episode_count INTEGER CHECK(episode_count IS NULL OR episode_count > 0),
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_ranked BOOLEAN NOT NULL DEFAULT TRUE,
  detail_synced_at TIMESTAMPTZ,
  ranking_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_media_items_type_ranking
  ON media_items(media_type, is_ranked, ranking, id);
