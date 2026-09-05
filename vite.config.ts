import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { gzipSync } from 'node:zlib'

const compressibleTypes = /^(text\/|application\/(javascript|json|manifest\+json|xml)|image\/svg\+xml|font\/)/i

function devResponseCompression() {
  return {
    name: 'dev-response-compression',
    configureServer(server: { middlewares: { use: (middleware: (request: any, response: any, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const acceptEncoding = String(request.headers?.['accept-encoding'] || '')
        const requestPath = String(request.url || '').split('?')[0]
        const isFrontendModule = /^\/(?:@vite\/|@react-refresh|@id\/|node_modules\/|src\/|assets\/)/.test(requestPath)
        if (!isFrontendModule || request.method !== 'GET' || request.headers?.upgrade || !/\bgzip\b/i.test(acceptEncoding)) {
          next()
          return
        }

        const chunks: Buffer[] = []
        const originalEnd = response.end.bind(response)
        response.write = (chunk: any, encoding?: BufferEncoding) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
          return true
        }
        response.end = (chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined))
          const body = Buffer.concat(chunks)
          const contentType = String(response.getHeader('content-type') || '')
          const callbackFn = typeof encoding === 'function' ? encoding : callback
          const shouldCompress = body.length >= 1024 && compressibleTypes.test(contentType) && !response.getHeader('content-encoding') && ![204, 304].includes(response.statusCode)

          if (shouldCompress) {
            const compressed = gzipSync(body, { level: 6 })
            response.removeHeader('content-length')
            response.setHeader('content-encoding', 'gzip')
            response.setHeader('vary', 'Accept-Encoding')
            response.setHeader('content-length', compressed.length)
            return originalEnd(compressed, callbackFn)
          }

          return originalEnd(body, callbackFn)
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devResponseCompression()],
    server: {
      host: '0.0.0.0',
      allowedHosts: [
        'yangtiancheng.cn',
        'www.yangtiancheng.cn',
        'proerp.cn',
        'www.proerp.cn',
        'qupindou.cn',
        'www.qupindou.cn',
      ],
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      warmup: {
        clientFiles: ['./src/main.tsx'],
      },
    },
  }
})
