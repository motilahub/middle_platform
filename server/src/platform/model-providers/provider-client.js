import dns from 'node:dns/promises'
import net from 'node:net'

const vendorDefinitions = {
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  zhipu: { name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  siliconflow: { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  moonshot: { name: 'Moonshot AI', baseUrl: 'https://api.moonshot.cn/v1' },
  custom: { name: '自定义（OpenAI 兼容）' },
}

const privateIpv4 = (value) => {
  const [first, second] = value.split('.').map(Number)
  return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 || first === 192 && second === 168 || first === 172 && second >= 16 && second <= 31
}

function isPrivateAddress(address) {
  const family = net.isIP(address)
  if (family === 4) return privateIpv4(address)
  if (family === 6) {
    const normalized = address.toLowerCase()
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
  }
  return true
}

export function normalizeBaseUrl(value) {
  let url
  try { url = new URL(String(value || '').trim()) } catch { throw Object.assign(new Error('服务地址必须是有效 URL'), { status: 400 }) }
  if (url.protocol !== 'https:') throw Object.assign(new Error('模型服务地址必须使用 HTTPS'), { status: 400 })
  if (url.username || url.password || !url.hostname || (net.isIP(url.hostname) && isPrivateAddress(url.hostname))) throw Object.assign(new Error('模型服务地址不允许使用本地或私网地址'), { status: 400 })
  return url.toString().replace(/\/$/, '')
}

async function ensurePublicHost(url) {
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw Object.assign(new Error('模型服务地址不能解析为本地或私网地址'), { status: 400 })
}

function responseError(response, fallback) {
  return response.text().then((text) => {
    let message = fallback
    try { message = JSON.parse(text).error?.message || JSON.parse(text).message || fallback } catch { /* Keep the safe fallback. */ }
    throw Object.assign(new Error(String(message).slice(0, 500)), { status: response.status === 401 || response.status === 403 ? 401 : 502 })
  })
}

export function createProviderClient(fetchImpl = fetch) {
  async function listModels({ baseUrl, apiKey }) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    const url = new URL(`${normalizedBaseUrl}/models`)
    await ensurePublicHost(url)
    let response
    try {
      response = await fetchImpl(url, {
        headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
        signal: AbortSignal.timeout(12_000), redirect: 'error',
      })
    } catch (error) {
      if (error?.name === 'TimeoutError') throw Object.assign(new Error('连接模型服务超时'), { status: 504 })
      throw Object.assign(new Error('无法连接模型服务'), { status: 502 })
    }
    if (!response.ok) return responseError(response, response.status === 401 || response.status === 403 ? '模型服务认证失败，请检查 API Key' : '模型服务返回异常')
    let payload
    try { payload = await response.json() } catch { throw Object.assign(new Error('模型服务未返回 JSON 数据'), { status: 502 }) }
    const models = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : []
    return [...new Set(models.map((model) => typeof model === 'string' ? model : model?.id || model?.name).filter((model) => typeof model === 'string' && model.trim()))].sort((left, right) => left.localeCompare(right))
  }
  return { listModels }
}

export { vendorDefinitions }
