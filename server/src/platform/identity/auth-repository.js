export function createAuthRepository(pool) {
  return {
    settings() { return pool.query('SELECT * FROM auth_mail_settings WHERE id=1').then((result) => result.rows[0]) },
    saveSettings(values) { return pool.query(`UPDATE auth_mail_settings SET registration_enabled=$1,smtp_host=$2,smtp_port=$3,smtp_secure=$4,smtp_user=$5,smtp_password_encrypted=$6,sender_email=$7,updated_at=NOW() WHERE id=1`, values) },
    findByEmail(email) { return pool.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email]).then((result) => result.rows[0]) },
    findByCode(code) { return pool.query('SELECT * FROM users WHERE code=$1', [code]).then((result) => result.rows[0]) },
    sessionVersion(id) { return pool.query('SELECT session_version FROM users WHERE id=$1', [id]).then((result) => result.rows[0]?.session_version) },
    async limit(action, subjectHash, maximum, windowSeconds) {
      if (Math.random() < 0.002) await pool.query("DELETE FROM auth_rate_events WHERE created_at < NOW() - INTERVAL '2 days'")
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${action}:${subjectHash}`])
        const count = await client.query("SELECT count(*)::integer AS total FROM auth_rate_events WHERE action=$1 AND subject_hash=$2 AND created_at > NOW() - $3 * INTERVAL '1 second'", [action, subjectHash, windowSeconds])
        if (count.rows[0].total >= maximum) { await client.query('COMMIT'); return false }
        await client.query('INSERT INTO auth_rate_events(action,subject_hash) VALUES($1,$2)', [action, subjectHash])
        await client.query('COMMIT')
        return true
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    },
    async issue(purpose, addressHash, codeHash) {
      return pool.query(`INSERT INTO auth_verifications(purpose,address_hash,code_hash,expires_at,attempts,sent_at)
        VALUES($1,$2,$3,NOW() + INTERVAL '5 minutes',0,NOW())
        ON CONFLICT(purpose,address_hash) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,sent_at=NOW()
        WHERE auth_verifications.sent_at <= NOW() - INTERVAL '60 seconds' RETURNING code_hash`, [purpose, addressHash, codeHash]).then((result) => result.rowCount > 0)
    },
    invalidate(purpose, addressHash, codeHash) { return pool.query('DELETE FROM auth_verifications WHERE purpose=$1 AND address_hash=$2 AND code_hash=$3', [purpose, addressHash, codeHash]) },
    async consume(purpose, addressHash, codeHash, onSuccess) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query('SELECT * FROM auth_verifications WHERE purpose=$1 AND address_hash=$2 FOR UPDATE', [purpose, addressHash])
        const row = result.rows[0]
        if (!row || row.attempts >= 3 || new Date(row.expires_at).getTime() <= Date.now()) {
          await client.query('COMMIT')
          return false
        }
        if (row.code_hash !== codeHash) {
          await client.query('UPDATE auth_verifications SET attempts=attempts+1 WHERE purpose=$1 AND address_hash=$2', [purpose, addressHash])
          await client.query('COMMIT')
          return false
        }
        await onSuccess(client)
        await client.query('DELETE FROM auth_verifications WHERE purpose=$1 AND address_hash=$2', [purpose, addressHash])
        await client.query('COMMIT')
        return true
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    },
    event(action, outcome, subjectHash, userId, ip) { return pool.query('INSERT INTO auth_events(action,outcome,subject_hash,user_id,ip_address) VALUES($1,$2,$3,$4,$5)', [action, outcome, subjectHash, userId || null, ip || null]) },
    async events({ page, pageSize, action, keyword }) {
      const params = []
      const filters = []
      if (action) { params.push(action); filters.push(`e.action=$${params.length}`) }
      if (keyword) { params.push(`%${keyword.replace(/[\\%_]/g, '\\$&')}%`); filters.push(`(u.code ILIKE $${params.length} ESCAPE '\\' OR e.ip_address ILIKE $${params.length} ESCAPE '\\')`) }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const count = await pool.query(`SELECT count(*)::integer AS total FROM auth_events e LEFT JOIN users u ON u.id=e.user_id ${where}`, params)
      const rows = await pool.query(`SELECT e.id,e.action,e.outcome,e.ip_address,e.created_at,u.code AS user_code FROM auth_events e LEFT JOIN users u ON u.id=e.user_id ${where} ORDER BY e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize])
      return { total: count.rows[0].total, rows: rows.rows }
    },
  }
}
