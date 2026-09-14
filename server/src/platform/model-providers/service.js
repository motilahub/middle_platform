import { mapModelProvider } from './repository.js'
import { normalizeBaseUrl, vendorDefinitions } from './provider-client.js'

const failure = (message, status = 400) => Object.assign(new Error(message), { status })
const codePattern = /^[a-z][a-z0-9_-]{2,79}$/

function providerValues(body, apiKeyEncrypted) {
  const code = String(body.code || '').trim()
  const name = String(body.name || '').trim().slice(0, 120)
  const vendor = String(body.vendor || '').trim()
  if (!codePattern.test(code)) throw failure('编码须为 3-80 位小写字母、数字、下划线或短横线，且以字母开头')
  if (!name) throw failure('供应商名称不能为空')
  if (!vendorDefinitions[vendor]) throw failure('模型供应商类型无效')
  const baseUrl = normalizeBaseUrl(body.baseUrl || vendorDefinitions[vendor].baseUrl)
  const defaultModel = String(body.defaultModel || '').trim().slice(0, 255) || null
  return { code, name, vendor, baseUrl, apiKeyEncrypted, enabled: body.enabled !== false, defaultModel, remark: String(body.remark || '').trim().slice(0, 500) || null }
}

export function createModelProviderService(repository, cipher, providerClient) {
  const encryptedApiKey = (body, existing = null, required = false) => {
    const apiKey = String(body.apiKey || '').trim()
    if (!apiKey && existing) return existing
    if (!apiKey && required) throw failure('请填写 API Key')
    if (apiKey.length < 8) throw failure('API Key 长度不能少于 8 位')
    return cipher.encrypt(apiKey)
  }
  const withSecret = (provider) => {
    if (!provider.api_key_encrypted) throw failure('该供应商尚未配置 API Key')
    return { ...provider, baseUrl: provider.base_url, apiKey: cipher.decrypt(provider.api_key_encrypted) }
  }
  const fetchModels = async (id, persist) => {
    const provider = await repository.find(id)
    if (!provider) throw failure('模型供应商不存在', 404)
    const models = await providerClient.listModels(withSecret(provider))
    if (persist) {
      await repository.saveModels(id, models)
      provider.models = models
    }
    return { provider: mapModelProvider(provider), models }
  }
  return {
    async list() { return (await repository.list()).map(mapModelProvider) },
    async create(body) {
      const values = providerValues(body, encryptedApiKey(body, null, true))
      return repository.create([values.code, values.name, values.vendor, values.baseUrl, values.apiKeyEncrypted, values.enabled, '[]', values.defaultModel, values.remark])
    },
    async update(id, body) {
      const existing = await repository.find(id)
      if (!existing) throw failure('模型供应商不存在', 404)
      const values = providerValues({ ...body, code: existing.code }, encryptedApiKey(body, existing.api_key_encrypted))
      await repository.update(id, [values.name, values.vendor, values.baseUrl, values.apiKeyEncrypted, values.enabled, values.defaultModel, values.remark])
    },
    async test(id) {
      const { models } = await fetchModels(id, false)
      return { success: true, modelCount: models.length, message: `连接成功，服务返回 ${models.length} 个模型` }
    },
    async syncModels(id) { return fetchModels(id, true) },
    setEnabled(id, enabled) { return repository.setEnabled(id, !!enabled) },
    deleteMany(ids) { return ids.length ? repository.deleteMany(ids) : undefined },
    deleteOne(id) { return repository.deleteOne(id) },
  }
}
