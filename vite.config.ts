import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
    },
  }
})
