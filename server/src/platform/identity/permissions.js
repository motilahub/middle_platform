export function createPermissionService(pool) {
  const allPermissions = () => pool.query('SELECT code FROM permissions ORDER BY code').then((result) => result.rows.map((row) => row.code))
  const groupCode = (value) => {
    const code = String(value || '').trim()
    if (!/^[a-z][a-z0-9_]{2,99}$/.test(code)) throw Object.assign(new Error('权限组编码须为 3-100 位小写字母、数字或下划线，且以字母开头'), { status: 400 })
    return code
  }
  const text = (value, label, maxLength, required = false) => {
    const result = String(value || '').trim().slice(0, maxLength)
    if (required && !result) throw Object.assign(new Error(`${label}不能为空`), { status: 400 })
    return result || null
  }
  const numberIds = (values) => [...new Set((values || []).map(Number).filter(Number.isSafeInteger).filter((id) => id > 0))]

  async function saveGroupRelations(client, groupId, permissionCodes, impliedGroupIds) {
    await client.query('DELETE FROM permission_group_permissions WHERE group_id=$1', [groupId])
    const codes = [...new Set((permissionCodes || []).map(String).filter(Boolean))]
    if (codes.length) await client.query(`INSERT INTO permission_group_permissions(group_id, permission_id)
      SELECT $1, id FROM permissions WHERE code=ANY($2::text[])`, [groupId, codes])
    await client.query('DELETE FROM permission_group_implied WHERE group_id=$1', [groupId])
    for (const impliedGroupId of numberIds(impliedGroupIds).filter((id) => id !== Number(groupId))) {
      await client.query('INSERT INTO permission_group_implied(group_id, implied_group_id) VALUES($1,$2)', [groupId, impliedGroupId])
    }
  }

  async function getAccess(user) {
    if (!user) return { groups: [], permissions: [] }
    const groupsResult = await pool.query(`
      WITH RECURSIVE user_groups AS (
        SELECT pg.id, pg.code, pg.name
        FROM user_permission_groups upg JOIN permission_groups pg ON pg.id = upg.group_id
        WHERE upg.user_id = $1
        UNION
        SELECT implied.id, implied.code, implied.name
        FROM user_groups current
        JOIN permission_group_implied edge ON edge.group_id = current.id
        JOIN permission_groups implied ON implied.id = edge.implied_group_id
      )
      SELECT DISTINCT code, name FROM user_groups ORDER BY code`, [user.id])
    const permissions = user.role === 'super_admin'
      ? await allPermissions()
      : (await pool.query(`
        WITH RECURSIVE effective_groups AS (
          SELECT group_id AS id FROM user_permission_groups WHERE user_id=$1
          UNION
          SELECT edge.implied_group_id
          FROM effective_groups current
          JOIN permission_group_implied edge ON edge.group_id=current.id
        )
        SELECT DISTINCT p.code
        FROM effective_groups groups
        JOIN permission_group_permissions gp ON gp.group_id = groups.id
        JOIN permissions p ON p.id = gp.permission_id
        ORDER BY p.code`, [user.id])).rows.map((row) => row.code)
    return { groups: groupsResult.rows, permissions }
  }

  return {
    async registerDefinitions(definitions = []) {
      for (const definition of definitions) {
        const code = typeof definition === 'string' ? definition : definition.code
        if (!code) continue
        const parts = code.split('.')
        const operation = parts.at(-1)
        if (!/^[a-z][a-z0-9_]*$/.test(operation)) throw new Error(`权限 ${code} 的操作编码无效`)
        const resource = parts.at(-2) || 'unknown'
        const module = parts.slice(0, -2).join('.') || 'business'
        const name = typeof definition === 'string' ? code : (definition.name || code)
        await pool.query(`INSERT INTO permissions(code,module,resource,operation,name) VALUES($1,$2,$3,$4,$5) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name`, [code, module, resource, operation, name])
      }
    },
    getAccess,
    async enrich(user) {
      const access = await getAccess(user)
      return { ...user, groups: access.groups, permissions: access.permissions }
    },
    has(user, permission) {
      // Existing sessions created before the RBAC migration may not contain a permission list.
      return user?.role === 'super_admin' || user?.permissions?.includes(permission) || (user?.role === 'admin' && !Array.isArray(user.permissions))
    },
    async listGroups() {
      return (await pool.query(`
        SELECT pg.id, pg.code, pg.name, pg.description,
          COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions,
          COALESCE(array_agg(DISTINCT implied.implied_group_id) FILTER (WHERE implied.implied_group_id IS NOT NULL), '{}') AS implied_group_ids
        FROM permission_groups pg
        LEFT JOIN permission_group_permissions gp ON gp.group_id = pg.id
        LEFT JOIN permissions p ON p.id = gp.permission_id
        LEFT JOIN permission_group_implied implied ON implied.group_id = pg.id
        GROUP BY pg.id ORDER BY pg.id`)).rows.map((row) => ({
        ...row,
        id: Number(row.id),
        permissions: row.permissions || [],
        impliedGroupIds: (row.implied_group_ids || []).map(Number),
      }))
    },
    async listDefinitions() {
      return (await pool.query('SELECT code, module, resource, operation, name FROM permissions ORDER BY module, resource, operation')).rows
    },
    async createGroup(body) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query('INSERT INTO permission_groups(code,name,description) VALUES($1,$2,$3) RETURNING id', [groupCode(body.code), text(body.name, '权限组名称', 120, true), text(body.description, '权限组说明', 255)])
        await saveGroupRelations(client, result.rows[0].id, body.permissions, body.impliedGroupIds)
        await client.query('COMMIT')
        return Number(result.rows[0].id)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    },
    async updateGroup(id, body) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query('UPDATE permission_groups SET name=$1,description=$2,updated_at=NOW() WHERE id=$3 RETURNING id', [text(body.name, '权限组名称', 120, true), text(body.description, '权限组说明', 255), id])
        if (!result.rowCount) throw Object.assign(new Error('权限组不存在'), { status: 404 })
        await saveGroupRelations(client, id, body.permissions, body.impliedGroupIds)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    },
    async deleteGroup(id) {
      const result = await pool.query("DELETE FROM permission_groups WHERE id=$1 AND code NOT IN ('platform_admin','platform_user')", [id])
      if (!result.rowCount) throw Object.assign(new Error('基础权限组不可删除或权限组不存在'), { status: 400 })
    },
    async setUserGroups(userId, groupIds = []) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM user_permission_groups WHERE user_id=$1', [userId])
        for (const groupId of [...new Set((groupIds || []).map(Number).filter(Number.isInteger))]) {
          await client.query('INSERT INTO user_permission_groups(user_id, group_id) VALUES($1,$2)', [userId, groupId])
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    },
  }
}
