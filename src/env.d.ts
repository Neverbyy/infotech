/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API, по умолчанию /api/v1 (servers[0].url из book.yaml). */
  readonly VITE_API_BASE_URL?: string
  /** 'true' — запросы обслуживает MSW-мок вместо реального бэкенда. */
  readonly VITE_USE_MOCK?: string
  /** Адрес бэкенда для dev-прокси, когда мок выключен. */
  readonly VITE_API_PROXY_TARGET?: string

  /* SMS-шлюз. Используется только моком: в проде уведомления шлёт бэкенд. */

  /** Базовый URL шлюза. По умолчанию /sms-gateway — прокси на smspilot.ru. */
  readonly VITE_SMS_GATEWAY_URL?: string
  /** Ключ SMSPILOT. По умолчанию ключ-эмулятор, реальные SMS не уходят. */
  readonly VITE_SMS_API_KEY?: string
  /** Зарегистрированное имя отправителя. Пусто — шлюз подставит своё. */
  readonly VITE_SMS_SENDER?: string
  /** 'false' убирает параметр test=1 из запроса к шлюзу. */
  readonly VITE_SMS_TEST_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
