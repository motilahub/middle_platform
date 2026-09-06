import { mapAgent, mapConversation, mapKnowledgeBase, mapMessage } from './repository.js'

const failure = (message, status = 400) => Object.assign(new Error(message), { status })

export function createAiAssistantService(repository, modelProviderService, attachmentStore, chatSettingsService) {
  const getConversation = async (id, userId) => {
    const conversation = await repository.findConversation(id, userId)
    if (!conversation) throw failure('会话不存在或无权访问', 404)
    return conversation
  }

  return {
    async listConversations(userId) { return (await repository.listConversations(userId)).map(mapConversation) },
    async createConversation(userId, body = {}) {
      const title = String(body.title || '新会话').trim().slice(0, 200) || '新会话'
      const agent = body.agentId ? await repository.findAgent(Number(body.agentId)) : await repository.findDefaultAgent()
      if (body.agentId && (!agent || !agent.enabled)) throw failure('智能体不存在或已停用', 404)
      return mapConversation(await repository.createConversation(userId, title, agent?.model_provider_id || Number(body.modelProviderId) || null, agent?.model_name || String(body.model || '').trim() || null, agent?.id || null))
    },
    async getConversation(id, userId) { return mapConversation(await getConversation(id, userId)) },
    async deleteConversation(id, userId) {
      const deleted = await repository.deleteConversation(id, userId)
      if (!deleted) throw failure('会话不存在或无权访问', 404)
    },
    async listMessages(id, userId) {
      await getConversation(id, userId)
      return (await repository.listMessages(id)).map(mapMessage)
    },
    async listModels() {
      return (await modelProviderService.listAvailable()).map((provider) => ({ id: provider.id, code: provider.code, name: provider.name, vendor: provider.vendor, models: provider.models, defaultModel: provider.defaultModel }))
    },
    async listAgents() { return (await repository.listAgents()).filter((agent) => agent.enabled).map(mapAgent) },
    async listAdminAgents() { return (await repository.listAdminAgents()).map(mapAgent) },
    async createAgent(body = {}) {
      const code = String(body.code || '').trim()
      const name = String(body.name || '').trim().slice(0, 120)
      if (!/^[a-z][a-z0-9_-]{2,79}$/.test(code)) throw failure('智能体编码须为 3-80 位小写字母、数字、下划线或短横线')
      if (!name) throw failure('智能体名称不能为空')
      const isDefault = !!body.isDefault
      if (isDefault) await repository.clearDefaultAgents()
      return mapAgent(await repository.createAgent([code, name, String(body.description || '').trim().slice(0, 500) || null, Number(body.modelProviderId) || null, String(body.model || '').trim() || null, String(body.systemPrompt || '').trim().slice(0, 20_000), JSON.stringify(body.settings && typeof body.settings === 'object' ? body.settings : {}), body.enabled !== false, isDefault]))
    },
    async updateAgent(id, body = {}) {
      const current = await repository.findAgent(Number(id))
      if (!current) throw failure('智能体不存在', 404)
      const name = String(body.name || '').trim().slice(0, 120)
      if (!name) throw failure('智能体名称不能为空')
      const isDefault = current.is_default ? true : !!body.isDefault
      if (isDefault) await repository.clearDefaultAgents(Number(id))
      return mapAgent(await repository.updateAgent(Number(id), [name, String(body.description || '').trim().slice(0, 500) || null, Number(body.modelProviderId) || null, String(body.model || '').trim() || null, String(body.systemPrompt || '').trim().slice(0, 20_000), JSON.stringify(body.settings && typeof body.settings === 'object' ? body.settings : {}), body.enabled !== false, isDefault]))
    },
    async deleteAgent(id) {
      const deleted = await repository.deleteAgent(Number(id))
      if (!deleted) throw failure('默认智能体不可删除或智能体不存在', 400)
    },
    async listKnowledgeBases(userId) { return (await repository.listKnowledgeBases(userId)).map(mapKnowledgeBase) },
    async createKnowledgeBase(userId, body = {}) {
      const name = String(body.name || '').trim().slice(0, 120)
      if (!name) throw failure('知识库名称不能为空')
      const description = String(body.description || '').trim().slice(0, 500)
      try {
        return mapKnowledgeBase(await repository.createKnowledgeBase(userId, name, description))
      } catch (error) {
        if (error?.code === '23505') throw failure('该知识库名称已存在', 409)
        throw error
      }
    },
    async createKnowledgeDocument(id, userId, body = {}) {
      const knowledgeBase = await repository.findKnowledgeBase(Number(id), userId)
      if (!knowledgeBase) throw failure('知识库不存在或无权访问', 404)
      const title = String(body.title || '未命名文档').trim().slice(0, 200) || '未命名文档'
      const content = String(body.content || '').trim()
      if (!content) throw failure('知识库文档内容不能为空')
      if (content.length > 200_000) throw failure('知识库文档不能超过 200000 个字符')
      return repository.createKnowledgeDocument(knowledgeBase.id, title, content).then((document) => ({ id: Number(document.id), title: document.title, createdAt: document.created_at }))
    },
    async listSkills() {
      return [
        { key: 'summarize', name: '总结', description: '总结当前对话或附件内容' },
        { key: 'translate', name: '翻译', description: '翻译当前输入内容' },
        { key: 'code-review', name: '代码审查', description: '审查代码并给出改进建议' },
      ]
    },
    async uploadAttachment(body) { return attachmentStore.save(body) },
    async prepareMessage(id, userId, body = {}) {
      const conversation = await getConversation(id, userId)
      const content = String(body.content || '').trim()
      const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
      if (content.length > 20_000) throw failure('消息内容不能超过 20000 个字符')
      const attachments = rawAttachments.slice(0, 5).map((item) => ({ name: String(item.name || '').slice(0, 255), url: String(item.url || '').slice(0, 500), originalUrl: item.originalUrl ? String(item.originalUrl).slice(0, 500) : undefined, mime: String(item.mime || '').slice(0, 120), size: Number(item.size) || 0 })).filter((item) => item.name && /^\/uploads\/ai\/[a-zA-Z0-9._-]+$/.test(item.url) && (!item.originalUrl || /^\/uploads\/ai\/[a-zA-Z0-9._-]+$/.test(item.originalUrl)) && item.size >= 0 && item.size <= 10 * 1024 * 1024)
      if (!content && !attachments.length) throw failure('消息内容不能为空')
      const skill = String(body.skill || '').trim().slice(0, 80)
      const knowledgeBaseId = Number(body.knowledgeBaseId) || null
      const requestedAgentId = Number(body.agentId) || Number(conversation.agent_id) || null
      const agent = requestedAgentId ? await repository.findAgent(requestedAgentId) : await repository.findDefaultAgent()
      if (!agent || !agent.enabled) throw failure('智能体不存在或已停用', 404)
      const providerId = Number(agent.model_provider_id) || Number(body.modelProviderId) || Number(conversation.model_provider_id) || null
      if (!providerId) throw failure('请先为智能体配置模型供应商')
      let knowledgeContext = ''
      if (knowledgeBaseId) {
        const knowledgeBase = await repository.findKnowledgeBase(knowledgeBaseId, userId)
        if (!knowledgeBase) throw failure('知识库不存在或无权访问', 404)
        const documents = await repository.searchKnowledgeDocuments(knowledgeBaseId, content.slice(0, 200), 5)
        if (documents.length) knowledgeContext = `\n知识库检索结果（${knowledgeBase.name}）：\n${documents.map((document) => `【${document.title}】\n${document.content.slice(0, 4000)}`).join('\n\n')}`
      }
      const history = (await repository.listMessages(id)).filter((message) => message.status === 'completed' && message.content).map((message) => ({ role: message.role, content: message.content + (message.attachments?.length ? `\n附件：${message.attachments.map((item) => item.name).join('、')}` : '') }))
      const chatSettings = chatSettingsService ? await chatSettingsService.aiChat() : null
      const maxRounds = Number(agent.settings?.maxRounds) || Number(chatSettings?.aiChatMaxRounds) || 0
      if (maxRounds > 0 && history.filter((message) => message.role === 'user').length >= maxRounds) throw failure('当前智能体已达到多轮对话上限')
      const promptContent = `${content || '请分析附件'}${attachments.length ? `\n附件：${attachments.map((item) => item.name).join('、')}` : ''}${skill ? `\n当前 Skill：${skill}` : ''}${knowledgeContext}`
      const userMessage = await repository.createMessage(id, 'user', content, 'completed', null, attachments)
      let target
      try {
        target = await modelProviderService.streamChat(providerId, agent.model_name || body.model || conversation.model_name, [{ role: 'system', content: agent.system_prompt || '你是一个可靠、清晰、简洁的助手。' }, ...history, { role: 'user', content: promptContent }])
      } catch (error) {
        await repository.updateMessage(userMessage.id, { content, status: 'failed', errorMessage: error.message })
        throw error
      }
      const assistantMessage = await repository.createMessage(id, 'assistant', '', 'pending', target.model)
      const title = conversation.title === '新会话' ? (content || attachments[0]?.name || '附件对话').slice(0, 80) : null
      await repository.touchConversation(id, title, providerId, target.model, agent.id)
      return { conversation: mapConversation({ ...conversation, title: title || conversation.title, model_provider_id: providerId, model_name: target.model, agent_id: agent.id }), agent: mapAgent(agent), userMessage: mapMessage(userMessage), assistantMessage: mapMessage(assistantMessage), stream: target.stream }
    },
    async appendAssistant(id, content) { return mapMessage(await repository.updateMessage(id, { content, status: 'pending' })) },
    async completeAssistant(id, content) { return mapMessage(await repository.updateMessage(id, { content, status: 'completed' })) },
    async failAssistant(id, content, errorMessage) { return mapMessage(await repository.updateMessage(id, { content, status: 'failed', errorMessage })) },
  }
}
