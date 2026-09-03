import pg from 'pg'
import bcrypt from 'bcryptjs'
import { runMigrations } from './db/migrate.js'
export { mapApp, mapSecuritySettings, mapSystemSettings, mapUser } from './shared/mappers.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export async function initDatabase() {
  await runMigrations(pool)
  const exists = await pool.query('SELECT id FROM users WHERE code=$1', ['admin'])
  if (!exists.rowCount) {
    const hash = await bcrypt.hash('admin', 12)
    await pool.query("INSERT INTO users(id,uuid,code,name,password_hash,role) VALUES(1,'00000000-0000-4000-8000-000000000001','admin','超级管理员',$1,'super_admin')", [hash])
    await pool.query("SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT MAX(id) FROM users), 1))")
  }
  await pool.query(`
    INSERT INTO user_permission_groups(user_id, group_id)
    SELECT u.id, g.id
    FROM users u
    JOIN permission_groups g ON g.code = CASE WHEN u.role IN ('super_admin', 'admin') THEN 'platform_admin' ELSE 'platform_user' END
    ON CONFLICT DO NOTHING`)
  await pool.query('INSERT INTO system_settings(id) VALUES(1) ON CONFLICT (id) DO NOTHING')
}
