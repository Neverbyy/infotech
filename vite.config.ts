import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const useMock = env.VITE_USE_MOCK === 'true'
  const proxyTarget = env.VITE_API_PROXY_TARGET

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // Когда мок выключен, dev-сервер проксирует /api на реальный бэкенд,
        // чтобы не ловить CORS при локальной разработке.
        ...(!useMock && proxyTarget ? { '/api': { target: proxyTarget, changeOrigin: true } } : {}),

        // SMS-шлюз не отдаёт CORS-заголовки, поэтому мок ходит к нему через прокси.
        // В проде этого маршрута нет: уведомления рассылает бэкенд.
        '/sms-gateway': {
          target: 'https://smspilot.ru',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sms-gateway/, '/api.php'),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.spec.ts'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
    },
  }
})
