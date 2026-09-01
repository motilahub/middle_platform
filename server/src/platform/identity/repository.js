export function createIdentityRepository(pool) {
  return {
    findByCode(code) { return pool.query('SELECT * FROM users WHERE code=$1', [code]).then((result) => result.rows[0]) },
    list() { return pool.query('SELECT * FROM users ORDER BY id').then((result) => result.rows) },
    create(values) { return pool.query('INSERT INTO users(uuid,code,name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *', values).then((result) => result.rows[0]) },
    update(id, values) { return pool.query('UPDATE users SET name=$1,role=$2,password_hash=COALESCE($3,password_hash),updated_at=NOW() WHERE id=$4', [...values, id]) },
    findCode(id) { return pool.query('SELECT code FROM users WHERE id=$1', [id]).then((result) => result.rows[0]) },
    remove(id) { return pool.query('DELETE FROM users WHERE id=$1', [id]) },
  }
}

