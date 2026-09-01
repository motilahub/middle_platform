import pg from 'pg'
import bcrypt from 'bcryptjs'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export async function initDatabase() {
  await pool.query(`
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
      system_title VARCHAR(120) NOT NULL DEFAULT 'AI财务助手',
      browser_title VARCHAR(120) NOT NULL DEFAULT 'AI财务助手',
      system_logo TEXT,
      title_logo TEXT,
      login_text VARCHAR(255) NOT NULL DEFAULT '后台配置系统',
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
  `)
  await pool.query(`
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS api_rate_limit_per_minute INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS show_workbench_header BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE system_settings ALTER COLUMN show_workbench_header SET DEFAULT TRUE;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_min_length INTEGER NOT NULL DEFAULT 8;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_uppercase BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_lowercase BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_special BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_number BOOLEAN NOT NULL DEFAULT TRUE;
  `)
  const exists = await pool.query('SELECT id FROM users WHERE code=$1', ['admin'])
  if (!exists.rowCount) {
    const hash = await bcrypt.hash('admin', 12)
    await pool.query("INSERT INTO users(id,uuid,code,name,password_hash,role) VALUES(1,'00000000-0000-4000-8000-000000000001','admin','超级管理员',$1,'super_admin')", [hash])
    await pool.query("SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT MAX(id) FROM users), 1))")
  }
  await pool.query('INSERT INTO system_settings(id) VALUES(1) ON CONFLICT (id) DO NOTHING')
}

export function mapUser(row) {
  return { id: Number(row.id), uuid: row.uuid, code: row.code, name: row.name, role: row.role }
}

export function mapApp(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, priority: row.priority,
    url: row.url, enabled: row.enabled, img: row.image_original || undefined,
    imgThumbnail: row.image_thumbnail || undefined, imgFileName: row.image_filename || undefined,
    userIds: (row.user_ids || []).map(Number),
  }
}

export function mapSsoConfig(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, direction: row.direction,
    protocol: row.protocol, systemUrl: row.system_url, verifyUrl: row.verify_url || undefined,
    authorizeUrl: row.authorize_url || undefined, callbackUrl: row.callback_url || undefined,
    issuer: row.issuer || undefined, clientId: row.client_id || undefined,
    userIdentifier: row.user_identifier || 'userId', enabled: row.enabled,
    remark: row.remark || undefined, priority: row.priority,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function mapSystemSettings(row) {
  return {
    systemTitle: row.system_title,
    browserTitle: row.browser_title,
    systemLogo: row.system_logo || undefined,
    titleLogo: row.title_logo || undefined,
    loginText: row.login_text,
    footerRecord: row.footer_record || undefined,
    showWorkbenchHeader: !!row.show_workbench_header,
    updatedAt: row.updated_at,
  }
}

export function mapSecuritySettings(row) {
  return {
    apiRateLimitPerMinute: Number(row.api_rate_limit_per_minute),
    passwordMinLength: Number(row.password_min_length),
    passwordRequireUppercase: !!row.password_require_uppercase,
    passwordRequireLowercase: !!row.password_require_lowercase,
    passwordRequireSpecial: !!row.password_require_special,
    passwordRequireNumber: !!row.password_require_number,
    updatedAt: row.updated_at,
  }
}
