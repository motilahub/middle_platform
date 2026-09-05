import assert from 'node:assert/strict'
import test from 'node:test'
import { createModelProviderService } from './service.js'

function createRepository() {
  const records = new Map()
  let nextId = 1
  return {
    async list() { return [...records.values()] },
    async find(id) { return records.get(Number(id)) },
    async create(values) {
      const [code, name, vendor, baseUrl, apiKeyEncrypted, enabled, models, defaultModel, remark] = values
      const id = nextId++
      records.set(id, { id, code, name, vendor, base_url: baseUrl, api_key_encrypted: apiKeyEncrypted, enabled, models: JSON.parse(models), default_model: defaultModel, remark })
      return id
    },
    async update(id, values) {
      const record = records.get(Number(id))
      const [name, vendor, baseUrl, apiKeyEncrypted, enabled, defaultModel, remark] = values
      Object.assign(record, { name, vendor, base_url: baseUrl, api_key_encrypted: apiKeyEncrypted, enabled, default_model: defaultModel, remark })
      return 1
    },
    async saveModels(id, models) { records.get(Number(id)).models = models },
    async setEnabled(id, enabled) { records.get(Number(id)).enabled = enabled },
    async deleteMany(ids) { ids.forEach((id) => records.delete(Number(id))) },
    async deleteOne(id) { records.delete(Number(id)) },
  }
}

const cipher = { encrypt: (value) => `encrypted:${value}`, decrypt: (value) => value.replace('encrypted:', '') }

test('model provider stores encrypted credentials and persists discovered models', async () => {
  const repository = createRepository()
  const client = { async listModels({ apiKey, baseUrl }) { assert.equal(apiKey, 'sk-example-key'); assert.equal(baseUrl, 'https://api.openai.com/v1'); return ['gpt-5-mini', 'gpt-5'] } }
  const service = createModelProviderService(repository, cipher, client)
  const id = await service.create({ code: 'openai_main', name: 'OpenAI', vendor: 'openai', apiKey: 'sk-example-key', enabled: true })
  const result = await service.syncModels(id)
  assert.deepEqual(result.models, ['gpt-5-mini', 'gpt-5'])
  assert.equal((await service.list())[0].hasApiKey, true)
  assert.deepEqual((await service.list())[0].models, ['gpt-5-mini', 'gpt-5'])
})

test('model provider rejects unsafe custom service addresses', async () => {
  const service = createModelProviderService(createRepository(), cipher, { listModels: async () => [] })
  await assert.rejects(() => service.create({ code: 'custom_local', name: 'Local', vendor: 'custom', baseUrl: 'https://127.0.0.1:11434/v1', apiKey: 'example-key' }), /本地或私网/)
})
