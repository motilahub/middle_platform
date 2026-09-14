ALTER TABLE sso_configs ADD COLUMN IF NOT EXISTS client_secret_hash TEXT;
ALTER TABLE sso_configs ADD COLUMN IF NOT EXISTS ticket_ttl_seconds INTEGER NOT NULL DEFAULT 30;
ALTER TABLE dashboard_apps ADD COLUMN IF NOT EXISTS outbound_sso_config_id BIGINT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='dashboard_apps_outbound_sso_config_id_fkey') THEN
    ALTER TABLE dashboard_apps
      ADD CONSTRAINT dashboard_apps_outbound_sso_config_id_fkey
      FOREIGN KEY (outbound_sso_config_id) REFERENCES sso_configs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sso_configs_ticket_ttl_seconds_check') THEN
    ALTER TABLE sso_configs
      ADD CONSTRAINT sso_configs_ticket_ttl_seconds_check
      CHECK (ticket_ttl_seconds BETWEEN 5 AND 300);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS outbound_sso_tickets (
  ticket_hash CHAR(64) PRIMARY KEY,
  sso_config_id BIGINT NOT NULL REFERENCES sso_configs(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbound_sso_tickets_expiry ON outbound_sso_tickets(expires_at);
