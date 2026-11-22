import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// 개별 개발의 /api 프록시는 기본 http://127.0.0.1:3000을 사용한다.
// 다른 주소는 실행 환경변수 API_PROXY_TARGET으로 지정한다. Docker 운영은 Nginx가 전달한다.
const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, ['API_PROXY_TARGET', 'CMMS_USE_POLLING'])
  return {
    plugins: [react(), tailwindcss()],
    // Vite 개발 서버 전용. 빌드된 정적 SPA는 Nginx가 제공한다.
    server: {
      // 파일 변경 감지가 동작하지 않는 마운트 환경에서만 CMMS_USE_POLLING=true로 지정한다.
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
