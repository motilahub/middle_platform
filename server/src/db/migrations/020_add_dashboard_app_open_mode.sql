ALTER TABLE dashboard_apps
  ADD COLUMN IF NOT EXISTS open_mode VARCHAR(20) NOT NULL DEFAULT 'current'
  CHECK (open_mode IN ('current', 'new_tab'));

UPDATE dashboard_apps SET open_mode='current' WHERE open_mode IS NULL;
