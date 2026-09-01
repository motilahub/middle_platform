let csrfToken: string | undefined

async function refreshCsrfToken() {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.token) throw new Error(body.message || '无法建立安全请求会话')
  csrfToken = body.token
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !csrfToken) await refreshCsrfToken()
  const headers = new Headers({ 'content-type': 'application/json', ...options.headers })
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token', csrfToken)
  const response = await fetch(url, { credentials: 'include', ...options, headers })
  const nextCsrfToken = response.headers.get('x-csrf-token')
  if (nextCsrfToken) csrfToken = nextCsrfToken
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || '请求失败')
  return body as T
}

export function clearCsrfToken() {
  csrfToken = undefined
}
