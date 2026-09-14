CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','admin','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_apps (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  image_original TEXT,
  image_thumbnail TEXT,
  image_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_app_users (
  app_id BIGINT NOT NULL REFERENCES dashboard_apps(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, user_id)
);

CREATE TABLE IF NOT EXISTS sso_configs (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound','outbound')),
  protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('oidc','cas','ticket','saml')),
  system_url TEXT NOT NULL,
  verify_url TEXT,
  authorize_url TEXT,
  callback_url TEXT,
  issuer TEXT,
  client_id VARCHAR(255),
  user_identifier VARCHAR(80) NOT NULL DEFAULT 'userId',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  remark TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  system_title VARCHAR(120) NOT NULL DEFAULT '集成平台',
  browser_title VARCHAR(120) NOT NULL DEFAULT '集成平台',
  system_logo TEXT,
  title_logo TEXT,
  login_text VARCHAR(255) NOT NULL DEFAULT '控制台',
  footer_record VARCHAR(255),
  show_workbench_header BOOLEAN NOT NULL DEFAULT TRUE,
  api_rate_limit_per_minute INTEGER NOT NULL DEFAULT 30,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  password_require_uppercase BOOLEAN NOT NULL DEFAULT TRUE,
  password_require_lowercase BOOLEAN NOT NULL DEFAULT TRUE,
  password_require_special BOOLEAN NOT NULL DEFAULT TRUE,
  password_require_number BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_configs_direction_priority ON sso_configs(direction, priority, id);
CREATE INDEX IF NOT EXISTS idx_dashboard_apps_priority ON dashboard_apps(priority, id);
