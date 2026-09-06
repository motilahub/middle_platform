import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiAssistantService } from './service.js'

function createRepository() {
  const conversations = new Map([[1, { id: 1, user_id: 7, title: '新会话', model_provider_id: null, model_name: null, status: 'active', created_at: '2026-09-06', updated_at: '2026-09-06' }]])
  const messages = []
  const knowledgeBase = { id: 5, user_id: 7, name: '产品知识', description: '说明', created_at: '2026-09-06', updated_at: '2026-09-06' }
  const agent = { id: 3, code: 'general-assistant', name: '通用助手', description: '', model_provider_id: 9, model_name: 'demo-model', system_prompt: '你是助手', settings: {}, enabled: true, is_default: true, created_at: '2026-09-06', updated_at: '2026-09-06' }
  let nextMessageId = 1
  return {
    async listConversations(userId) { return [...conversations.values()].filter((item) => item.user_id === userId) },
    async createConversation(userId, title, providerId, model) { const item = { id: 2, user_id: userId, title, model_provider_id: providerId, model_name: model, status: 'active', created_at: '2026-09-06', updated_at: '2026-09-06' }; conversations.set(item.id, item); return item },
    async findConversation(id, userId) { const item = conversations.get(Number(id)); return item?.user_id === userId ? item : undefined },
    async deleteConversation(id, userId) { return conversations.get(Number(id))?.user_id === userId ? (conversations.delete(Number(id)), 1) : 0 },
    async listMessages(conversationId) { return messages.filter((item) => item.conversation_id === Number(conversationId)) },
    async listKnowledgeBases(userId) { return userId === 7 ? [knowledgeBase] : [] },
    async findKnowledgeBase(id, userId) { return Number(id) === knowledgeBase.id && userId === knowledgeBase.user_id ? knowledgeBase : undefined },
    async searchKnowledgeDocuments() { return [{ id: 8, title: '安装说明', content: '安装步骤和常见问题' }] },
    async findAgent(id) { return Number(id) === agent.id ? agent : undefined },
    async findDefaultAgent() { return agent },
    async createMessage(conversationId, role, content, status, model, attachments = []) { const item = { id: nextMessageId++, conversation_id: Number(conversationId), role, content, status, model, attachments, created_at: '2026-09-06' }; messages.push(item); return item },
    async updateMessage(id, values) { const item = messages.find((value) => value.id === Number(id)); Object.assign(item, { ...values, error_message: values.errorMessage }); return item },
    async touchConversation(id, title, providerId, model) { const item = conversations.get(Number(id)); if (title) item.title = title; item.model_provider_id = providerId; item.model_name = model },
  }
}

test('AI service isolates conversations by user and prepares model history', async () => {
  const repository = createRepository()
  let receivedMessages
  const service = createAiAssistantService(repository, {
    async listAvailable() { return [{ id: 9, code: 'demo', name: 'Demo', vendor: 'custom', models: ['demo-model'], defaultModel: 'demo-model' }] },
    async streamChat(id, model, messages) { assert.equal(id, 9); assert.equal(model, 'demo-model'); receivedMessages = messages; return { model, stream: (async function* () { yield '回复' })() } },
  })
  await assert.rejects(() => service.getConversation(1, 8), /无权访问/)
  const prepared = await service.prepareMessage(1, 7, { content: '你好', modelProviderId: 9, model: 'demo-model' })
  assert.equal(prepared.assistantMessage.model, 'demo-model')
  assert.deepEqual(receivedMessages, [{ role: 'system', content: '你是助手' }, { role: 'user', content: '你好' }])
})

test('AI service validates attachments and injects selected knowledge context', async () => {
  const repository = createRepository()
  let receivedMessages
  const service = createAiAssistantService(repository, {
    async listAvailable() { return [] },
    async streamChat(_id, model, messages) { receivedMessages = messages; return { model, stream: (async function* () { yield 'ok' })() } },
  })
  const prepared = await service.prepareMessage(1, 7, {
    content: '怎么安装',
    modelProviderId: 9,
    model: 'demo-model',
    knowledgeBaseId: 5,
    attachments: [
      { name: 'guide.txt', url: '/uploads/ai/file-guide.txt', mime: 'text/plain', size: 12 },
      { name: 'external.txt', url: 'https://example.com/file.txt', mime: 'text/plain', size: 12 },
    ],
  })
  assert.equal(prepared.userMessage.attachments.length, 1)
  assert.match(receivedMessages.at(-1).content, /安装说明/)
})
