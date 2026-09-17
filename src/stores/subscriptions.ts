import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { notificationsApi, subscriptionsApi } from '@/api'
import { useToastsStore } from '@/stores/toasts'
import type { ListData, SmsNotification, SubscriptionState } from '@/types/api'
import { errorMessage } from '@/utils/errors'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import { normalizePhone } from '@/utils/validation'

const PHONE_KEY = 'catalog.subscriber.phone'

/**
 * Период опроса журнала уведомлений.
 *
 * Спека — обычный REST без push-канала, поэтому «реальное время» здесь — это
 * поллинг. На настоящем проекте правильнее SSE или WebSocket: тогда сервер сам
 * сообщает об отправленном SMS, и лишние запросы не нужны.
 */
const POLL_INTERVAL_MS = 10_000

/**
 * Подписка гостя на новинки автора с уведомлением по SMS.
 *
 * У гостя нет аккаунта, поэтому идентификатором подписчика выступает номер
 * телефона: он запрашивается один раз и запоминается локально, чтобы при
 * возврате на сайт кнопка «Подписаться» показывала актуальное состояние.
 * Эндпоинтов в book.yaml нет — контракт описан в api/subscriptions.addendum.yaml.
 */
export const useSubscriptionsStore = defineStore('subscriptions', () => {
  const phone = ref<string>(readStorage<string>(PHONE_KEY, ''))
  const items = ref<SubscriptionState[]>([])
  const notifications = ref<SmsNotification[]>([])
  const loading = ref(false)
  const pendingAuthorId = ref<number | null>(null)
  const error = ref<string | null>(null)

  const hasPhone = computed(() => phone.value !== '')
  const subscribedIds = computed(() => new Set(items.value.map((item) => item.author_id)))
  const count = computed(() => items.value.length)

  function isSubscribed(authorId: number): boolean {
    return subscribedIds.value.has(authorId)
  }

  function isPending(authorId: number): boolean {
    return pendingAuthorId.value === authorId
  }

  function remember(value: string): void {
    if (phone.value === value) return
    phone.value = value
    writeStorage(PHONE_KEY, value)
  }

  /* Первая загрузка только наполняет журнал: уведомлять о том, что пришло
     до открытия страницы, не нужно. */
  let primed = false

  function applyNotifications(next: SmsNotification[]): void {
    const knownMaxId = notifications.value.reduce((max, item) => Math.max(max, item.id), 0)
    const fresh = next.filter((item) => item.id > knownMaxId)
    notifications.value = next

    if (!primed) {
      primed = true
      return
    }

    const toasts = useToastsStore()
    for (const item of fresh) {
      toasts.info(`SMS отправлено: новинка автора ${item.author_name} — «${item.book_title}»`)
    }
  }

  /* Журнал тянут сразу трое: восстановление сессии при старте, поллинг и сама
     страница подписок. Держим промис в полёте, чтобы параллельные вызовы
     склеивались в один запрос вместо трёх одинаковых. */
  let notificationsRequest: Promise<ListData<SmsNotification>> | null = null
  let loadRequest: { phone: string; promise: Promise<void> } | null = null

  function fetchNotificationsOnce(value: string): Promise<ListData<SmsNotification>> {
    notificationsRequest ??= notificationsApi.list(value).finally(() => {
      notificationsRequest = null
    })
    return notificationsRequest
  }

  async function loadFor(nextPhone: string): Promise<void> {
    const value = normalizePhone(nextPhone)
    if (!value) return

    // Тот же номер уже грузится — присоединяемся, а не дублируем запросы.
    if (loadRequest?.phone === value) return loadRequest.promise

    if (value !== phone.value) primed = false
    remember(value)

    const promise = (async () => {
      loading.value = true
      error.value = null
      try {
        const [subscriptions, sent] = await Promise.all([
          subscriptionsApi.list(value),
          fetchNotificationsOnce(value),
        ])
        items.value = subscriptions.items ?? []
        applyNotifications(sent.items ?? [])
      } catch (caught) {
        items.value = []
        notifications.value = []
        error.value = errorMessage(caught, 'Не удалось загрузить подписки')
      } finally {
        loading.value = false
        loadRequest = null
      }
    })()

    loadRequest = { phone: value, promise }
    return promise
  }

  /**
   * Тихое обновление журнала для поллинга: без флага загрузки и без баннера
   * ошибки — моргать интерфейсом раз в десять секунд не нужно.
   */
  async function refreshNotifications(): Promise<void> {
    if (!phone.value) return
    try {
      const sent = await fetchNotificationsOnce(phone.value)
      applyNotifications(sent.items ?? [])
    } catch {
      /* временная недоступность сети не должна ломать страницу */
    }
  }

  /** Восстанавливает подписки при старте, если номер уже известен. */
  async function restore(): Promise<void> {
    if (phone.value) await loadFor(phone.value)
  }

  async function subscribe(authorId: number, subscriberPhone: string): Promise<void> {
    const value = normalizePhone(subscriberPhone)
    pendingAuthorId.value = authorId
    try {
      const subscription = await subscriptionsApi.subscribe(authorId, { phone: value })
      remember(value)
      items.value = [...items.value.filter((item) => item.author_id !== authorId), subscription]
      // Подтягиваем журнал: у номера могла быть история с прошлых подписок.
      void refreshNotifications()
    } finally {
      pendingAuthorId.value = null
    }
  }

  async function unsubscribe(authorId: number): Promise<void> {
    if (!phone.value) return
    pendingAuthorId.value = authorId
    try {
      await subscriptionsApi.unsubscribe(authorId, { phone: phone.value })
      items.value = items.value.filter((item) => item.author_id !== authorId)
    } finally {
      pendingAuthorId.value = null
    }
  }

  function forget(): void {
    phone.value = ''
    items.value = []
    notifications.value = []
    primed = false
    removeStorage(PHONE_KEY)
  }

  /* ── Поллинг журнала ────────────────────────────────────────────────────
     Счётчик подписчиков, а не один флаг: страница подписок и приложение
     целиком включают поллинг независимо, и уход со страницы не должен гасить
     опрос, пока он нужен кому-то ещё. */

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollUsers = 0
  let onVisibilityChange: (() => void) | null = null

  const polling = computed(() => pollTimer !== null)

  /** В фоновой вкладке опрашивать бессмысленно — экономим запросы и батарею. */
  function isVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  function startPolling(): void {
    pollUsers += 1
    if (pollTimer !== null) return

    void refreshNotifications()

    pollTimer = setInterval(() => {
      if (isVisible()) void refreshNotifications()
    }, POLL_INTERVAL_MS)

    if (typeof document !== 'undefined') {
      // Вернулись во вкладку — показываем свежее сразу, не ожидая тика.
      onVisibilityChange = () => {
        if (isVisible()) void refreshNotifications()
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  }

  function stopPolling(): void {
    pollUsers = Math.max(0, pollUsers - 1)
    if (pollUsers > 0 || pollTimer === null) return

    clearInterval(pollTimer)
    pollTimer = null

    if (onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      onVisibilityChange = null
    }
  }

  return {
    phone,
    items,
    notifications,
    loading,
    error,
    hasPhone,
    subscribedIds,
    count,
    polling,
    isSubscribed,
    isPending,
    loadFor,
    refreshNotifications,
    startPolling,
    stopPolling,
    restore,
    subscribe,
    unsubscribe,
    forget,
  }
})
