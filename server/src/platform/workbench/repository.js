const appSelect = `SELECT a.*, COALESCE(array_agg(au.user_id) FILTER (WHERE au.user_id IS NOT NULL), '{}') user_ids
  FROM dashboard_apps a LEFT JOIN dashboard_app_users au ON au.app_id=a.id GROUP BY a.id`

export function createWorkbenchRepository(pool) {
  return {
    listVisible(userId) { return pool.query(`${appSelect} HAVING a.enabled=TRUE AND (COUNT(au.user_id)=0 OR $1=ANY(array_agg(au.user_id))) ORDER BY a.priority,a.id`, [userId]).then((result) => result.rows) },
    listAll() { return pool.query(`${appSelect} ORDER BY a.priority,a.id`).then((result) => result.rows) },
    find(id) { return pool.query('SELECT * FROM dashboard_apps WHERE id=$1', [id]).then((result) => result.rows[0]) },
    async create(values, userIds) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query('INSERT INTO dashboard_apps(code,name,priority,url,enabled,image_original,image_thumbnail,image_filename,outbound_sso_config_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', values)
        await this.saveUsers(client, result.rows[0].id, userIds)
        await client.query('COMMIT')
        return Number(result.rows[0].id)
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    },
    async update(id, values, userIds) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('UPDATE dashboard_apps SET name=$1,priority=$2,url=$3,enabled=$4,image_original=$5,image_thumbnail=$6,image_filename=$7,outbound_sso_config_id=$8,updated_at=NOW() WHERE id=$9', [...values, id])
        await this.saveUsers(client, id, userIds)
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    },
    async saveUsers(client, appId, userIds) {
      await client.query('DELETE FROM dashboard_app_users WHERE app_id=$1', [appId])
      for (const userId of userIds || []) await client.query('INSERT INTO dashboard_app_users(app_id,user_id) VALUES($1,$2)', [appId, userId])
    },
    setEnabled(id, enabled) { return pool.query('UPDATE dashboard_apps SET enabled=$1,updated_at=NOW() WHERE id=$2', [enabled, id]) },
    async reorder(ids) {
      const client = await pool.connect()
      try { await client.query('BEGIN'); for (let i = 0; i < ids.length; i += 1) await client.query('UPDATE dashboard_apps SET priority=$1 WHERE id=$2', [i + 1, ids[i]]); await client.query('COMMIT') }
      catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    },
    deleteMany(ids) { return pool.query('DELETE FROM dashboard_apps WHERE id=ANY($1::bigint[]) RETURNING *', [ids]).then((result) => result.rows) },
    deleteOne(id) { return pool.query('DELETE FROM dashboard_apps WHERE id=$1 RETURNING *', [id]).then((result) => result.rows[0]) },
  }
}

