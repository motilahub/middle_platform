import assert from 'node:assert/strict'
import test from 'node:test'
import { createSettingsService } from './service.js'
import { createSettingsRepository } from './repository.js'
import { mapSystemSettings } from '../../shared/mappers.js'

test('工作台通知保存、清空及旧客户端更新时保留原值', async () => {
  const row = { system_title: 'Motila', browser_title: 'Motila', login_text: '控制台', workbench_notice: null }
  const repository = {
    async readSystem() { return row },
    async updateSystem(values) { row.workbench_notice = values[10]; return row },
  }
  const imageStore = { async persist() { throw new Error('未更新图片时不应调用') } }
  const service = createSettingsService(repository, imageStore, { mapSystemSettings }, {})

  assert.equal((await service.system()).workbenchNotice, undefined)
  assert.equal((await service.updateSystem({ workbenchNotice: ' <strong>停机通知</strong> ' })).workbenchNotice, '<strong>停机通知</strong>')
  assert.equal((await service.updateSystem({ systemTitle: '新标题' })).workbenchNotice, '<strong>停机通知</strong>')
  assert.equal((await service.updateSystem({ workbenchNotice: '' })).workbenchNotice, undefined)
})

test('AI Chat 有效状态默认开启，可关闭并兼容旧客户端更新', async () => {
  const row = { ai_chat_welcome: '欢迎', ai_chat_first_prompt_count: 3, ai_chat_max_rounds: 20, ai_chat_followup_count: 3, ai_chat_theme: 'light', ai_chat_effects: true, ai_chat_enabled: true }
  const repository = {
    async readAiChat() { return row },
    async updateAiChat(values) { row.ai_chat_enabled = values[8]; return row },
  }
  const service = createSettingsService(repository, { async persistIcon() { throw new Error('未更新图片时不应调用') } }, { mapSystemSettings }, {})

  assert.equal(mapSystemSettings({}).aiChatEnabled, true)
  assert.equal((await service.updateAiChat({ aiChatEnabled: false })).aiChatEnabled, false)
  assert.equal((await service.updateAiChat({ aiChatWelcome: '新的欢迎词' })).aiChatEnabled, false)
  await assert.rejects(service.updateAiChat({ aiChatEnabled: 'false' }), (error) => error.status === 400)
  assert.equal((await service.updateAiChat({ aiChatEnabled: true })).aiChatEnabled, true)
})

test('AI Chat 数据查询及写入包含有效状态', async () => {
  const queries = []
  const repository = createSettingsRepository({ async query(sql, params) { queries.push({ sql, params }); return { rows: [{ ai_chat_enabled: false }] } } })
  await repository.readSystem()
  await repository.readAiChat()
  await repository.updateAiChat([null, 3, 20, 3, null, null, 'light', true, false])
  assert.match(queries[0].sql, /ai_chat_enabled/)
  assert.match(queries[1].sql, /SELECT ai_chat_enabled/)
  assert.match(queries[2].sql, /ai_chat_enabled=\$9/)
  assert.equal(queries[2].params[8], false)
})
