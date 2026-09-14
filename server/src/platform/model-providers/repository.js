const columns = 'id,code,name,vendor,base_url,api_key_encrypted,enabled,models,default_model,remark,created_at,updated_at'

export function mapModelProvider(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, vendor: row.vendor, baseUrl: row.base_url,
    hasApiKey: !!row.api_key_encrypted, enabled: !!row.enabled, models: Array.isArray(row.models) ? row.models : [],
    defaultModel: row.default_model || undefined, remark: row.remark || undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function createModelProviderRepository(pool) {
  return {
    list() { return pool.query(`SELECT ${columns} FROM model_providers ORDER BY id`).then((result) => result.rows) },
    find(id) { return pool.query(`SELECT ${columns} FROM model_providers WHERE id=$1`, [id]).then((result) => result.rows[0]) },
    create(values) { return pool.query(`INSERT INTO model_providers(code,name,vendor,base_url,api_key_encrypted,enabled,models,default_model,remark) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING id`, values).then((result) => Number(result.rows[0].id)) },
    update(id, values) { return pool.query(`UPDATE model_providers SET name=$1,vendor=$2,base_url=$3,api_key_encrypted=$4,enabled=$5,default_model=$6,remark=$7,updated_at=NOW() WHERE id=$8`, [...values, id]).then((result) => result.rowCount) },
    saveModels(id, models) { return pool.query('UPDATE model_providers SET models=$1::jsonb,updated_at=NOW() WHERE id=$2', [JSON.stringify(models), id]) },
    setEnabled(id, enabled) { return pool.query('UPDATE model_providers SET enabled=$1,updated_at=NOW() WHERE id=$2', [enabled, id]) },
    deleteMany(ids) { return pool.query('DELETE FROM model_providers WHERE id=ANY($1::bigint[])', [ids]) },
    deleteOne(id) { return pool.query('DELETE FROM model_providers WHERE id=$1', [id]) },
  }
}
