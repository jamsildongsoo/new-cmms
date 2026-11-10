import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, ['API_PROXY_TARGET', 'CMMS_USE_POLLING'])
  return {
    plugins: [react(), tailwindcss()],
    server: {
      watch: { usePolling: (process.env.CMMS_USE_POLLING ?? env.CMMS_USE_POLLING) === 'true' },
      proxy: {
        '/api': process.env.API_PROXY_TARGET ?? env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
      },
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
