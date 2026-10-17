import assert from 'node:assert/strict'
import test from 'node:test'
import { createPanSouProvider, isAllowedPanLink, parsePanSouResponse } from './pansouProvider.js'

const payload = {
  code: 0,
  message: 'success',
  data: { merged_by_type: {
    quark: [{ url: 'https://pan.quark.cn/s/demo', note: '三体全集', password: '1234', source: 'tg:测试频道' }],
    baidu: [{ url: 'https://pan.baidu.com/s/demo', note: '三体' }],
  } },
}

test('解析 PanSou merged_by_type 为直达网盘结果', () => {
  const results = parsePanSouResponse(payload)
  assert.equal(results.length, 2)
  assert.equal(results[0].provider, 'pansou')
  assert.equal(results[0].storageType, 'quark')
  assert.match(results[0].title, /提取码：1234/)
  assert.equal(results[0].sourceLine, 'tg:测试频道')
  assert.equal(results[0].linkMode, 'direct')
})

test('PanSou 搜索使用配置地址和 POST 请求契约', async () => {
  let calledUrl
  let calledOptions
  const provider = createPanSouProvider({
    getBaseUrl: () => 'http://localhost:8889/api/search',
    fetch: async (url, options) => {
      calledUrl = url
      calledOptions = options
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  const output = await provider.search('三体')
  assert.equal(calledUrl, 'http://localhost:8889/api/search')
  assert.deepEqual(JSON.parse(calledOptions.body), { kw: '三体', res: 'merge', src: 'all', cloud_types: [] })
  assert.equal(output.results.length, 2)
})

test('每次搜索读取最新配置地址', async () => {
  let address = 'http://localhost:8888/api/search'
  const addresses = []
  const provider = createPanSouProvider({ getBaseUrl: () => address, fetch: async (url) => {
    addresses.push(url)
    return new Response(JSON.stringify(payload))
  } })
  await provider.search('一')
  address = 'http://localhost:8889/api/search'
  await provider.search('二')
  assert.deepEqual(addresses, ['http://localhost:8888/api/search', 'http://localhost:8889/api/search'])
})

test('拒绝错误响应和不受信任的直链', async () => {
  await assert.rejects(createPanSouProvider({ fetch: async () => new Response(JSON.stringify({ code: 500, message: '失败' })) }).search('三体'), /失败/)
  await assert.rejects(createPanSouProvider({ fetch: async () => { throw new Error('connection refused') } }).search('三体'), (error) => error.message === '搜索服务暂时无法连接' && !error.message.includes('PanSou'))
  assert.equal(isAllowedPanLink('https://pan.baidu.com/s/demo'), true)
  assert.equal(isAllowedPanLink('magnet:?xt=urn:btih:demo'), true)
  assert.equal(isAllowedPanLink('http://pan.baidu.com/s/demo'), false)
  assert.equal(isAllowedPanLink('https://example.com/?next=https://pan.baidu.com'), false)
})
