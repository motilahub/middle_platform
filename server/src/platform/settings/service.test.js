import assert from 'node:assert/strict'
import test from 'node:test'
import { createSettingsService } from './service.js'
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
