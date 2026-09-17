import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notificationsApi, subscriptionsApi } from '@/api'
import { ApiError } from '@/api/http'
import { useToastsStore } from '@/stores/toasts'
import type { ListData, SmsNotification, SubscriptionState } from '@/types/api'
import { useSubscriptionsStore } from './subscriptions'

vi.mock('@/api', () => ({
  subscriptionsApi: { list: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
  notificationsApi: { list: vi.fn() },
}))

const api = vi.mocked(subscriptionsApi)
const notifications = vi.mocked(notificationsApi)

const PHONE = '79991234567'

const subscription = (authorId: number, phone = PHONE): SubscriptionState => ({
  author_id: authorId,
  full_name: `Автор ${authorId}`,
  phone,
  subscribed_at: '2026-01-15T10:00:00.000Z',
})

const notification = (id: number): SmsNotification => ({
  id,
  phone: PHONE,
  author_id: 1,
  author_name: 'Автор 1',
  book_id: 1,
  book_title: 'Новинка',
  text: 'Новинка автора Автор 1: «Новинка». Книжный каталог.',
  sent_at: '2026-01-16T10:00:00.000Z',
  status: 'sent',
  details: 'server_id 123',
})

function list<T>(items: T[]): ListData<T> {
  return { items, pagination: { total: items.length, page: 1, per_page: items.length || 1, total_pages: 1 } }
}

describe('useSubscriptionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.resetAllMocks()
  })

  it('стартует без номера и подписок', () => {
    const store = useSubscriptionsStore()
    expect(store.hasPhone).toBe(false)
    expect(store.count).toBe(0)
    expect(store.isSubscribed(1)).toBe(false)
  })

  it('нормализует номер к формату шлюза и запоминает его', async () => {
    api.list.mockResolvedValue(list([subscription(1)]))
    notifications.list.mockResolvedValue(list([]))
    const store = useSubscriptionsStore()

    await store.loadFor('+7 (999) 123-45-67')

    expect(api.list).toHaveBeenCalledWith(PHONE)
    expect(store.phone).toBe(PHONE)
    expect(store.isSubscribed(1)).toBe(true)
    expect(JSON.parse(localStorage.getItem('catalog.subscriber.phone')!)).toBe(PHONE)
  })

  it('загружает журнал отправленных SMS вместе с подписками', async () => {
    api.list.mockResolvedValue(list([subscription(1)]))
    notifications.list.mockResolvedValue(list([notification(1), notification(2)]))
    const store = useSubscriptionsStore()

    await store.loadFor(PHONE)

    expect(notifications.list).toHaveBeenCalledWith(PHONE)
    expect(store.notifications).toHaveLength(2)
  })

  it('добавляет подписку без дублей при повторном вызове', async () => {
    api.subscribe.mockResolvedValue(subscription(7))
    const store = useSubscriptionsStore()

    await store.subscribe(7, '8 999 123 45 67')
    await store.subscribe(7, PHONE)

    expect(store.count).toBe(1)
    expect(store.isSubscribed(7)).toBe(true)
    expect(api.subscribe).toHaveBeenCalledWith(7, { phone: PHONE })
  })

  it('снимает флаг ожидания даже при ошибке подписки', async () => {
    api.subscribe.mockRejectedValue(
      new ApiError(422, [{ field: 'phone', message: 'Некорректный номер телефона' }]),
    )
    const store = useSubscriptionsStore()

    await expect(store.subscribe(3, '123')).rejects.toThrow('Некорректный номер телефона')
    expect(store.isPending(3)).toBe(false)
    expect(store.isSubscribed(3)).toBe(false)
  })

  it('удаляет подписку локально после отписки', async () => {
    api.subscribe.mockResolvedValue(subscription(2))
    api.unsubscribe.mockResolvedValue(undefined)
    const store = useSubscriptionsStore()
    await store.subscribe(2, PHONE)

    await store.unsubscribe(2)

    expect(api.unsubscribe).toHaveBeenCalledWith(2, { phone: PHONE })
    expect(store.isSubscribed(2)).toBe(false)
  })

  it('ничего не делает при отписке без известного номера', async () => {
    const store = useSubscriptionsStore()

    await store.unsubscribe(1)

    expect(api.unsubscribe).not.toHaveBeenCalled()
  })

  it('сохраняет сообщение об ошибке загрузки', async () => {
    api.list.mockRejectedValue(new ApiError(0, []))
    notifications.list.mockResolvedValue(list([]))
    const store = useSubscriptionsStore()

    await store.loadFor(PHONE)

    expect(store.items).toEqual([])
    expect(store.error).toBe('Сервер недоступен. Проверьте подключение')
  })

  describe('поллинг журнала', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function withPhone() {
      api.list.mockResolvedValue(list([subscription(1)]))
      notifications.list.mockResolvedValue(list([]))
      const store = useSubscriptionsStore()
      await store.loadFor(PHONE)
      notifications.list.mockClear()
      return store
    }

    it('опрашивает журнал сразу при запуске и дальше по таймеру', async () => {
      const store = await withPhone()

      store.startPolling()
      await vi.advanceTimersByTimeAsync(0)
      expect(notifications.list).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(10_000)
      expect(notifications.list).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(10_000)
      expect(notifications.list).toHaveBeenCalledTimes(3)

      store.stopPolling()
    })

    it('прекращает опрос после остановки', async () => {
      const store = await withPhone()

      store.startPolling()
      await vi.advanceTimersByTimeAsync(0)
      store.stopPolling()
      notifications.list.mockClear()

      await vi.advanceTimersByTimeAsync(30_000)
      expect(notifications.list).not.toHaveBeenCalled()
    })

    it('продолжает опрос, пока его просит хотя бы один потребитель', async () => {
      const store = await withPhone()

      store.startPolling()
      store.startPolling()
      await vi.advanceTimersByTimeAsync(0)
      store.stopPolling()
      notifications.list.mockClear()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(notifications.list).toHaveBeenCalledTimes(1)

      store.stopPolling()
    })

    it('не ходит в API без номера', async () => {
      const store = useSubscriptionsStore()

      store.startPolling()
      await vi.advanceTimersByTimeAsync(30_000)

      expect(notifications.list).not.toHaveBeenCalled()
      store.stopPolling()
    })

    it('молчит об истории, но сообщает о новом уведомлении', async () => {
      const toasts = useToastsStore()
      api.list.mockResolvedValue(list([subscription(1)]))
      notifications.list.mockResolvedValue(list([notification(1)]))
      const store = useSubscriptionsStore()

      // То, что уже было на момент открытия страницы, — не новость.
      await store.loadFor(PHONE)
      expect(store.notifications).toHaveLength(1)
      expect(toasts.items).toHaveLength(0)

      // А это уже пришло при нас — уведомляем.
      notifications.list.mockResolvedValue(list([notification(2), notification(1)]))
      await store.refreshNotifications()

      expect(store.notifications).toHaveLength(2)
      expect(toasts.items).toHaveLength(1)
      expect(toasts.items[0]?.text).toContain('Автор 1')
    })

    it('не повторяет тост при следующем опросе', async () => {
      const toasts = useToastsStore()
      const store = await withPhone()

      notifications.list.mockResolvedValue(list([notification(1)]))
      await store.refreshNotifications()
      expect(toasts.items).toHaveLength(1)

      // Тот же журнал на следующем тике — второй раз не сообщаем.
      await store.refreshNotifications()
      expect(toasts.items).toHaveLength(1)
    })

    it('не роняет страницу, когда опрос не удался', async () => {
      const store = await withPhone()
      notifications.list.mockRejectedValue(new ApiError(0, []))

      await store.refreshNotifications()

      expect(store.error).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  it('забывает подписчика вместе с журналом SMS', async () => {
    api.list.mockResolvedValue(list([subscription(4)]))
    notifications.list.mockResolvedValue(list([notification(1)]))
    const store = useSubscriptionsStore()
    await store.loadFor(PHONE)

    store.forget()

    expect(store.hasPhone).toBe(false)
    expect(store.count).toBe(0)
    expect(store.notifications).toEqual([])
    expect(localStorage.getItem('catalog.subscriber.phone')).toBeNull()
  })
})
