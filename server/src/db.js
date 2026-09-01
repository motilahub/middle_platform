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
    CREATE INDEX IF NOT EXISTS idx_sso_configs_direction_priority ON sso_configs(direction, priority, id);
    CREATE INDEX IF NOT EXISTS idx_dashboard_apps_priority ON dashboard_apps(priority, id);
  `)
  const exists = await pool.query('SELECT id FROM users WHERE code=$1', ['admin'])
  if (!exists.rowCount) {
    const hash = await bcrypt.hash('admin', 12)
    await pool.query("INSERT INTO users(id,uuid,code,name,password_hash,role) VALUES(1,'00000000-0000-4000-8000-000000000001','admin','超级管理员',$1,'super_admin')", [hash])
    await pool.query("SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT MAX(id) FROM users), 1))")
  }
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
