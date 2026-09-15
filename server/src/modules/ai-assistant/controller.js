export function createAiAssistantController(service) {
  const writeEvent = (res, event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  }
  return {
    listConversations: async (req, res) => res.json(await service.listConversations(req.session.user.id)),
    createConversation: async (req, res) => res.status(201).json(await service.createConversation(req.session.user.id, req.body)),
    getConversation: async (req, res) => res.json(await service.getConversation(req.params.id, req.session.user.id)),
    deleteConversation: async (req, res) => { await service.deleteConversation(req.params.id, req.session.user.id); res.status(204).end() },
    listMessages: async (req, res) => res.json(await service.listMessages(req.params.id, req.session.user.id)),
    listModels: async (_req, res) => res.json(await service.listModels()),
    listAgents: async (_req, res) => res.json(await service.listAgents()),
    listAdminAgents: async (_req, res) => res.json(await service.listAdminAgents()),
    createAgent: async (req, res) => res.status(201).json(await service.createAgent(req.body)),
    updateAgent: async (req, res) => res.json(await service.updateAgent(req.params.id, req.body)),
    deleteAgent: async (req, res) => { await service.deleteAgent(req.params.id); res.status(204).end() },
    listKnowledgeBases: async (req, res) => res.json(await service.listKnowledgeBases(req.session.user.id)),
    createKnowledgeBase: async (req, res) => res.status(201).json(await service.createKnowledgeBase(req.session.user.id, req.body)),
    createKnowledgeDocument: async (req, res) => res.status(201).json(await service.createKnowledgeDocument(req.params.id, req.session.user.id, req.body)),
    listSkills: async (_req, res) => res.json(await service.listSkills()),
    uploadAttachment: async (req, res) => res.status(201).json(await service.uploadAttachment(req.body)),
    sendMessage: async (req, res) => {
      const prepared = await service.prepareMessage(req.params.id, req.session.user.id, req.body)
      res.status(200)
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()
      writeEvent(res, 'start', { conversationId: prepared.conversation.id, userMessageId: prepared.userMessage.id, messageId: prepared.assistantMessage.id, model: prepared.assistantMessage.model })
      let content = ''
      try {
        for await (const delta of prepared.stream) {
          content += delta
          await service.appendAssistant(prepared.assistantMessage.id, content)
          writeEvent(res, 'message', { conversationId: prepared.conversation.id, messageId: prepared.assistantMessage.id, delta })
        }
        await service.completeAssistant(prepared.assistantMessage.id, content)
        writeEvent(res, 'done', { messageId: prepared.assistantMessage.id })
      } catch (error) {
        await service.failAssistant(prepared.assistantMessage.id, content, error.message).catch(() => {})
        writeEvent(res, 'error', { message: error.message || '模型服务异常' })
      } finally {
        res.end()
      }
    },
  }
}
