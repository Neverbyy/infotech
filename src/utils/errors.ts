import { ApiError } from '@/api/http'

/** Работа с ошибками, прилетевшими из транспорта. */

/**
 * Текст для тоста или баннера: сообщение сервера, если оно есть, иначе запасное.
 * Сервер знает про свою ошибку больше нас, поэтому его формулировка в приоритете.
 */
export function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback
}

/**
 * Отменённый запрос — не ошибка: AbortController рвёт fetch через DOMException,
 * и такой «сбой» не должен попадать ни в состояние, ни в уведомления.
 */
export function isAbortError(caught: unknown): boolean {
  return caught instanceof DOMException && caught.name === 'AbortError'
}
