const ssoColumns = 'id,code,name,direction,protocol,system_url,verify_url,authorize_url,callback_url,issuer,client_id,client_secret_hash,user_identifier,ticket_ttl_seconds,enabled,remark,priority,created_at,updated_at'

export function mapSsoConfig(row) {
  return {
    id: Number(row.id), code: row.code, name: row.name, direction: row.direction,
    protocol: row.protocol, systemUrl: row.system_url, verifyUrl: row.verify_url || undefined,
    authorizeUrl: row.authorize_url || undefined, callbackUrl: row.callback_url || undefined,
    issuer: row.issuer || undefined, clientId: row.client_id || undefined,
    hasClientSecret: !!row.client_secret_hash, ticketTtlSeconds: Number(row.ticket_ttl_seconds || 30),
    userIdentifier: row.user_identifier || 'userId', enabled: row.enabled,
    remark: row.remark || undefined, priority: row.priority,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function createSsoRepository(pool) {
  return {
    async findEnabledInbound(code) {
      return (await pool.query(`SELECT ${ssoColumns} FROM sso_configs WHERE code=$1 AND direction='inbound' AND enabled=TRUE`, [code])).rows[0]
    },
    async findEnabledOutbound(code) {
      return (await pool.query(`SELECT ${ssoColumns} FROM sso_configs WHERE code=$1 AND direction='outbound' AND protocol='ticket' AND enabled=TRUE`, [code])).rows[0]
    },
    async findUserByCode(code) {
      return (await pool.query('SELECT * FROM users WHERE code=$1', [code])).rows[0]
    },
    async consumeTicket(configId, ticketHash) {
      return (await pool.query(`UPDATE outbound_sso_tickets ticket SET consumed_at=NOW()
        FROM users WHERE ticket.ticket_hash=$1 AND ticket.sso_config_id=$2 AND ticket.user_id=users.id
          AND ticket.consumed_at IS NULL AND ticket.expires_at>NOW()
        RETURNING users.*`, [ticketHash, configId])).rows[0]
    },
    async findLaunchConfig(appId, userId) {
      return (await pool.query(`SELECT s.* FROM dashboard_apps app
        JOIN sso_configs s ON s.id=app.outbound_sso_config_id
        WHERE app.id=$1 AND app.enabled=TRUE AND s.direction='outbound' AND s.protocol='ticket' AND s.enabled=TRUE
          AND (app.visibility='public'
            OR EXISTS (SELECT 1 FROM dashboard_app_users WHERE app_id=app.id AND user_id=$2))`, [appId, userId])).rows[0]
    },
    async issueTicket(ticketHash, configId, userId, expiresAt) {
      await pool.query('INSERT INTO outbound_sso_tickets(ticket_hash,sso_config_id,user_id,expires_at) VALUES($1,$2,$3,$4)', [ticketHash, configId, userId, expiresAt])
    },
    async deleteExpiredTickets() {
      await pool.query("DELETE FROM outbound_sso_tickets WHERE expires_at<NOW()-INTERVAL '1 hour'")
    },
    async findOutboundTicketConfigId(id) {
      return (await pool.query("SELECT id FROM sso_configs WHERE id=$1 AND direction='outbound' AND protocol='ticket'", [id])).rows[0]
    },
    async list(direction) {
      return (await pool.query(`SELECT ${ssoColumns} FROM sso_configs WHERE direction=$1 ORDER BY priority,id`, [direction])).rows
    },
    async findForUpdate(id, direction) {
      return (await pool.query('SELECT client_secret_hash FROM sso_configs WHERE id=$1 AND direction=$2', [id, direction])).rows[0]
    },
    async create(values) {
      const result = await pool.query(`INSERT INTO sso_configs(code,name,direction,protocol,system_url,verify_url,authorize_url,callback_url,issuer,client_id,client_secret_hash,user_identifier,ticket_ttl_seconds,enabled,remark,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`, values)
      return Number(result.rows[0].id)
    },
    async update(values) {
      return (await pool.query(`UPDATE sso_configs SET name=$1,protocol=$2,system_url=$3,verify_url=$4,authorize_url=$5,callback_url=$6,issuer=$7,client_id=$8,client_secret_hash=$9,user_identifier=$10,ticket_ttl_seconds=$11,enabled=$12,remark=$13,priority=$14,updated_at=NOW() WHERE id=$15 AND direction=$16`, values)).rowCount
    },
    async setEnabled(id, direction, enabled) {
      await pool.query('UPDATE sso_configs SET enabled=$1,updated_at=NOW() WHERE id=$2 AND direction=$3', [enabled, id, direction])
    },
    async deleteMany(ids, direction) {
      await pool.query('DELETE FROM sso_configs WHERE id=ANY($1::bigint[]) AND direction=$2', [ids, direction])
    },
    async deleteOne(id, direction) {
      await pool.query('DELETE FROM sso_configs WHERE id=$1 AND direction=$2', [id, direction])
    },
  }
}
