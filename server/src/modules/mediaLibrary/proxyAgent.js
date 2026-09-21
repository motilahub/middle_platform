import { ProxyAgent } from 'proxy-agent'

const SUPPORTED_PROXY_PROTOCOLS = new Set([
  'http:', 'https:', 'socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:',
])

export function createFixedProxyAgent(value) {
  const proxyUrl = String(value || '').trim()
  let parsed
  try { parsed = new URL(proxyUrl) } catch { throw new Error('代理地址无效') }
  if (!SUPPORTED_PROXY_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) throw new Error('代理地址无效')

  return new ProxyAgent({ getProxyForUrl: () => proxyUrl })
}
