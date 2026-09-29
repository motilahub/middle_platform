ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_mail_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER NOT NULL DEFAULT 465 CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
  smtp_user VARCHAR(255),
  smtp_password_encrypted TEXT,
  sender_email VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO auth_mail_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS auth_verifications (
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'reset')),
  address_hash CHAR(64) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (purpose, address_hash)
);

CREATE TABLE IF NOT EXISTS auth_rate_events (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(32) NOT NULL,
  subject_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_rate_events_lookup ON auth_rate_events(action,subject_hash,created_at);

CREATE TABLE IF NOT EXISTS auth_events (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(32) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  subject_hash CHAR(64),
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_events_created ON auth_events(created_at DESC);
