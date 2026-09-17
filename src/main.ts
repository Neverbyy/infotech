import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useSubscriptionsStore } from './stores/subscriptions'
import './assets/styles/main.css'

async function startMockServer(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}

async function bootstrap(): Promise<void> {
  // Мок должен перехватывать запросы до того, как компоненты начнут их слать.
  await startMockServer()

  const app = createApp(App)
  app.use(createPinia())

  // Сессию и подписки поднимаем до навигации: от них зависят guard'ы и шапка.
  useAuthStore().restore()
  void useSubscriptionsStore().restore()

  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
