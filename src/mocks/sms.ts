/**
 * Клиент SMS-шлюза SMSPILOT (API-1, HTTP GET).
 *
 * Лежит внутри src/mocks намеренно: рассылка уведомлений — работа бэкенда,
 * и в реальном проекте ключ шлюза никогда не попадает во фронтенд. Здесь мок
 * играет роль бэкенда, а вся папка mocks вырезается из прод-сборки вместе с MSW.
 *
 * Документация: https://smspilot.ru/apikey.php?tab=api1
 */

/** Ключ-эмулятор из документации: запросы принимаются, реальные SMS не уходят. */
export const EMULATOR_API_KEY =
  'XXXXXXXXXXXXYYYYYYYYYYYYZZZZZZZZXXXXXXXXXXXXYYYYYYYYYYYYZZZZZZZZ'

/* Обращаемся не напрямую на smspilot.ru, а через прокси dev-сервера Vite:
   браузер иначе упрётся в CORS. См. vite.config.ts → server.proxy. */
const GATEWAY_URL = import.meta.env.VITE_SMS_GATEWAY_URL ?? '/sms-gateway'
const API_KEY = import.meta.env.VITE_SMS_API_KEY ?? EMULATOR_API_KEY
const SENDER = import.meta.env.VITE_SMS_SENDER ?? ''
const TEST_MODE = import.meta.env.VITE_SMS_TEST_MODE !== 'false'

interface SmsPilotSuccess {
  send?: { server_id?: string; phone?: string; price?: string; status?: string }[]
  balance?: string
  cost?: string
}

interface SmsPilotFailure {
  /** code приходит числом, хотя в документации показан строкой. */
  error?: { code?: string | number; description?: string; description_ru?: string }
}

export interface SmsResult {
  status: 'sent' | 'failed'
  /** server_id при успехе либо текст ошибки — кладём в журнал уведомлений. */
  details: string
}

/** Текст уведомления. SMS платная и режется по длине, поэтому коротко. */
export function newBookMessage(bookTitle: string, authorName: string): string {
  return `Новинка автора ${authorName}: «${bookTitle}». Книжный каталог.`
}

export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  if (!API_KEY) return { status: 'failed', details: 'Не задан ключ SMS-шлюза' }

  const params = new URLSearchParams({ send: text, to: phone, apikey: API_KEY, format: 'json' })
  if (SENDER) params.set('from', SENDER)
  if (TEST_MODE) params.set('test', '1')

  try {
    const response = await fetch(`${GATEWAY_URL}?${params.toString()}`)
    const payload = (await response.json()) as SmsPilotSuccess & SmsPilotFailure

    if (payload.error) {
      const reason = payload.error.description_ru ?? payload.error.description ?? 'неизвестная ошибка'
      return { status: 'failed', details: `${payload.error.code ?? '—'}: ${reason}` }
    }

    const first = payload.send?.[0]
    return { status: 'sent', details: first?.server_id ? `server_id ${first.server_id}` : 'принято шлюзом' }
  } catch (caught) {
    // Нет сети или шлюз недоступен — подписку это ломать не должно.
    return { status: 'failed', details: caught instanceof Error ? caught.message : 'шлюз недоступен' }
  }
}
