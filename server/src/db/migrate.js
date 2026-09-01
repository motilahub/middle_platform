import fs from 'node:fs/promises'

const migrationDirectory = new URL('./migrations/', import.meta.url)
const migrationLockId = 20260901002

export async function runMigrations(pool) {
  const files = (await fs.readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort()
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name))
    for (const fileName of files) {
      if (applied.has(fileName)) continue
      const sql = await fs.readFile(new URL(fileName, migrationDirectory), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [fileName])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]).catch(() => {})
    client.release()
  }
}
