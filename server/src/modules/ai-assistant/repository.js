const conversationColumns = 'id,user_id,title,model_provider_id,model_name,agent_id,status,created_at,updated_at'
const messageColumns = 'id,conversation_id,role,content,status,model,token_usage,error_message,attachments,created_at'
const knowledgeBaseColumns = 'id,user_id,name,description,created_at,updated_at'
const agentColumns = 'id,code,name,description,model_provider_id,model_name,system_prompt,settings,enabled,is_default,created_at,updated_at'

export function createAiAssistantRepository(pool) {
  return {
    listConversations(userId) {
      return pool.query(`SELECT ${conversationColumns} FROM ai_conversations WHERE user_id=$1 ORDER BY updated_at DESC,id DESC`, [userId]).then((result) => result.rows)
    },
    createConversation(userId, title, providerId, model, agentId) {
      return pool.query('INSERT INTO ai_conversations(user_id,title,model_provider_id,model_name,agent_id) VALUES($1,$2,$3,$4,$5) RETURNING *', [userId, title, providerId || null, model || null, agentId || null]).then((result) => result.rows[0])
    },
    findConversation(id, userId) {
      return pool.query(`SELECT ${conversationColumns} FROM ai_conversations WHERE id=$1 AND user_id=$2`, [id, userId]).then((result) => result.rows[0])
    },
    deleteConversation(id, userId) {
      return pool.query('DELETE FROM ai_conversations WHERE id=$1 AND user_id=$2', [id, userId]).then((result) => result.rowCount)
    },
    listMessages(conversationId) {
      return pool.query(`SELECT ${messageColumns} FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at,id`, [conversationId]).then((result) => result.rows)
    },
    listKnowledgeBases(userId) {
      return pool.query(`SELECT ${knowledgeBaseColumns} FROM ai_knowledge_bases WHERE user_id=$1 ORDER BY updated_at DESC,id DESC`, [userId]).then((result) => result.rows)
    },
    createKnowledgeBase(userId, name, description) {
      return pool.query('INSERT INTO ai_knowledge_bases(user_id,name,description) VALUES($1,$2,$3) RETURNING *', [userId, name, description || null]).then((result) => result.rows[0])
    },
    findKnowledgeBase(id, userId) {
      return pool.query(`SELECT ${knowledgeBaseColumns} FROM ai_knowledge_bases WHERE id=$1 AND user_id=$2`, [id, userId]).then((result) => result.rows[0])
    },
    createKnowledgeDocument(knowledgeBaseId, title, content) {
      return pool.query('INSERT INTO ai_knowledge_documents(knowledge_base_id,title,content) VALUES($1,$2,$3) RETURNING *', [knowledgeBaseId, title, content]).then((result) => result.rows[0])
    },
    searchKnowledgeDocuments(knowledgeBaseId, query, limit = 5) {
      return pool.query(`
        SELECT id,title,content
        FROM ai_knowledge_documents
        WHERE knowledge_base_id=$1
          AND ($2='' OR title ILIKE '%' || $2 || '%' OR content ILIKE '%' || $2 || '%')
        ORDER BY updated_at DESC,id DESC
        LIMIT $3`, [knowledgeBaseId, query, limit]).then((result) => result.rows)
    },
    createMessage(conversationId, role, content, status, model, attachments = []) {
      return pool.query('INSERT INTO ai_messages(conversation_id,role,content,status,model,attachments) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *', [conversationId, role, content || '', status, model || null, JSON.stringify(attachments)]).then((result) => result.rows[0])
    },
    updateMessage(id, values) {
      return pool.query('UPDATE ai_messages SET content=$1,status=$2,error_message=$3,token_usage=$4::jsonb WHERE id=$5 RETURNING *', [values.content || '', values.status, values.errorMessage || null, values.tokenUsage ? JSON.stringify(values.tokenUsage) : null, id]).then((result) => result.rows[0])
    },
    touchConversation(id, title, providerId, model, agentId) {
      return pool.query('UPDATE ai_conversations SET title=COALESCE($1,title),model_provider_id=COALESCE($2,model_provider_id),model_name=COALESCE($3,model_name),agent_id=COALESCE($4,agent_id),updated_at=NOW() WHERE id=$5', [title || null, providerId || null, model || null, agentId || null, id])
    },
    listAgents() { return pool.query(`SELECT ${agentColumns} FROM ai_agents ORDER BY is_default DESC,name,id`).then((result) => result.rows) },
    listAdminAgents() { return pool.query(`SELECT ${agentColumns} FROM ai_agents ORDER BY is_default DESC,name,id`).then((result) => result.rows) },
    findAgent(id) { return pool.query(`SELECT ${agentColumns} FROM ai_agents WHERE id=$1`, [id]).then((result) => result.rows[0]) },
    findDefaultAgent() { return pool.query(`SELECT ${agentColumns} FROM ai_agents WHERE is_default=true AND enabled=true ORDER BY id LIMIT 1`).then((result) => result.rows[0]) },
    createAgent(values) { return pool.query(`INSERT INTO ai_agents(code,name,description,model_provider_id,model_name,system_prompt,settings,enabled,is_default) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING ${agentColumns}`, values).then((result) => result.rows[0]) },
    updateAgent(id, values) { return pool.query(`UPDATE ai_agents SET name=$1,description=$2,model_provider_id=$3,model_name=$4,system_prompt=$5,settings=$6::jsonb,enabled=$7,is_default=$8,updated_at=NOW() WHERE id=$9 RETURNING ${agentColumns}`, [...values, id]).then((result) => result.rows[0]) },
    clearDefaultAgents(exceptId = null) { return pool.query('UPDATE ai_agents SET is_default=false,updated_at=NOW() WHERE ($1::bigint IS NULL OR id<>$1)', [exceptId]) },
    deleteAgent(id) { return pool.query('DELETE FROM ai_agents WHERE id=$1 AND is_default=false', [id]).then((result) => result.rowCount) },
  }
}

export function mapConversation(row) {
  return { id: Number(row.id), title: row.title, modelProviderId: row.model_provider_id ? Number(row.model_provider_id) : undefined, model: row.model_name || undefined, agentId: row.agent_id ? Number(row.agent_id) : undefined, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }
}

export function mapMessage(row) {
  return { id: Number(row.id), conversationId: Number(row.conversation_id), role: row.role, content: row.content, status: row.status, model: row.model || undefined, tokenUsage: row.token_usage || undefined, errorMessage: row.error_message || undefined, attachments: row.attachments || [], createdAt: row.created_at }
}

export function mapKnowledgeBase(row) {
  return { id: Number(row.id), name: row.name, description: row.description || undefined, createdAt: row.created_at, updatedAt: row.updated_at }
}

export function mapAgent(row) {
  return { id: Number(row.id), code: row.code, name: row.name, description: row.description || undefined, modelProviderId: row.model_provider_id ? Number(row.model_provider_id) : undefined, model: row.model_name || undefined, systemPrompt: row.system_prompt || '', settings: row.settings || {}, enabled: !!row.enabled, isDefault: !!row.is_default, createdAt: row.created_at, updatedAt: row.updated_at }
}
