CREATE TABLE IF NOT EXISTS dashboard_categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dashboard_apps
  ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES dashboard_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_categories_priority ON dashboard_categories(priority, id);
CREATE INDEX IF NOT EXISTS idx_dashboard_apps_category_priority ON dashboard_apps(category_id, priority, id);
