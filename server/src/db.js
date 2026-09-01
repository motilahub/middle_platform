import pg from 'pg'
import bcrypt from 'bcryptjs'
import { runMigrations } from './db/migrate.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export async function initDatabase() {
  await runMigrations(pool)
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
    outboundSsoConfigId: row.outbound_sso_config_id ? Number(row.outbound_sso_config_id) : undefined,
    userIds: (row.user_ids || []).map(Number),
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
