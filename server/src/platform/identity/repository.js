export function createIdentityRepository(pool) {
  return {
    findByLogin(identifier) { return pool.query('SELECT * FROM users WHERE code=$1 OR lower(email)=lower($1) ORDER BY (code=$1) DESC LIMIT 1', [identifier]).then((result) => result.rows[0]) },
    findById(id) { return pool.query('SELECT * FROM users WHERE id=$1', [id]).then((result) => result.rows[0]) },
    list() { return pool.query('SELECT * FROM users ORDER BY id').then((result) => result.rows) },
    create(values) { return pool.query('INSERT INTO users(uuid,code,name,password_hash,role,avatar,avatar_original,avatar_thumbnail,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', values).then((result) => result.rows[0]) },
    update(id, values) { return pool.query('UPDATE users SET name=$1,role=$2,password_hash=COALESCE($3,password_hash),avatar=$4,avatar_original=$5,avatar_thumbnail=$6,email=$7,phone=$8,session_version=session_version+CASE WHEN $3::text IS NULL THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=$9', [...values, id]) },
    updateAvatar(id, values) { return pool.query('UPDATE users SET avatar=$1,avatar_original=$2,avatar_thumbnail=$3,updated_at=NOW() WHERE id=$4', [...values, id]) },
    findCode(id) { return pool.query('SELECT code,avatar,avatar_original,avatar_thumbnail,email,phone FROM users WHERE id=$1', [id]).then((result) => result.rows[0]) },
    defaultGroupIds(role) { return pool.query('SELECT id FROM permission_groups WHERE code=$1', [role === 'user' ? 'platform_user' : 'platform_admin']).then((result) => result.rows.map((row) => Number(row.id))) },
    remove(id) { return pool.query('DELETE FROM users WHERE id=$1', [id]) },
  }
}
