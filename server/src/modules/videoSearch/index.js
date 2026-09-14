import express from 'express'
import { createPanSouProvider } from './pansouProvider.js'
import { createResolveToken, readResolveToken } from './token.js'

const SOURCE_IDS = new Set(['tiancha'])

function validateKeyword(value) {
  const keyword = String(value || '').trim()
  if (!keyword) throw Object.assign(new Error('请输入影视名称'), { status: 400 })
  if (keyword.length > 50) throw Object.assign(new Error('影视名称不能超过 50 个字符'), { status: 400 })
  return keyword
}

const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

export function createVideoSearchRouter({ tokenSecret, providerOptions } = {}) {
  if (!tokenSecret) throw new Error('天影查模块缺少令牌签名密钥')
  const router = express.Router()
  const providers = new Map([['tiancha', createPanSouProvider(providerOptions)]])

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post('/search', route(async (req, res) => {
    const keyword = validateKeyword(req.body.keyword)
    const requested = Array.isArray(req.body.sources) && req.body.sources.length ? req.body.sources : [...SOURCE_IDS]
    const sourceIds = [...new Set(requested.map(String))].filter((source) => SOURCE_IDS.has(source))
    if (!sourceIds.length) return res.status(400).json({ message: '请至少选择一个可用搜索源' })
    const settled = await Promise.allSettled(sourceIds.map(async (sourceId) => {
      const provider = providers.get(sourceId)
      const output = await provider.search(keyword)
      return {
        source: { id: sourceId, name: provider.name, status: output.status, count: output.results.length, message: output.message },
        results: output.results.map(({ rawToken, ...item }) => ({
          ...item,
          linkMode: 'resolve',
          resolveToken: createResolveToken({ provider: sourceId, rawToken, title: item.title }, tokenSecret),
        })),
      }
    }))
    const sources = []
    const results = []
    settled.forEach((item, index) => {
      if (item.status === 'fulfilled') {
        sources.push(item.value.source)
        results.push(...item.value.results)
      } else {
        sources.push({ id: sourceIds[index], name: providers.get(sourceIds[index])?.name || sourceIds[index], status: 'failed', count: 0, message: item.reason?.message || '搜索失败' })
      }
    })
    res.json({ keyword, results, sources })
  }))

  router.post('/resolve', route(async (req, res) => {
    const data = readResolveToken(req.body.resolveToken, tokenSecret)
    const provider = providers.get(data.provider)
    if (!provider) return res.status(400).json({ message: '搜索源已不可用' })
    const url = await provider.resolve(data.rawToken, data.title)
    res.json({ url })
  }))

  return router
}
