import type { ErrorItem, ErrorResponse, SuccessResponse } from '@/types/api'
import { errorsToFieldMap, type FieldErrors } from '@/utils/validation'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * Ошибка API в терминах спеки: HTTP-статус + массив errors[] из конверта
 * { success: false, errors: [{ field, message }] }.
 */
export class ApiError extends Error {
  readonly status: number
  readonly errors: ErrorItem[]

  constructor(status: number, errors: ErrorItem[], message?: string) {
    super(message ?? errors[0]?.message ?? defaultMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  /** Ошибки валидации по полям — для подсветки инпутов в формах. */
  get fieldErrors(): FieldErrors {
    return errorsToFieldMap(this.errors)
  }

  /** Ошибки без привязки к полю — показываем общим блоком над формой. */
  get generalErrors(): string[] {
    const general = this.errors.filter((item) => !item.field).map((item) => item.message)
    return general.length > 0 ? general : this.errors.length === 0 ? [this.message] : []
  }

  get isValidation(): boolean {
    return this.status === 422
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Некорректный запрос'
    case 401:
      return 'Требуется авторизация'
    case 403:
      return 'Недостаточно прав'
    case 404:
      return 'Не найдено'
    case 422:
      return 'Проверьте правильность заполнения полей'
    case 0:
      return 'Сервер недоступен. Проверьте подключение'
    default:
      return status >= 500 ? 'Ошибка на стороне сервера' : 'Не удалось выполнить запрос'
  }
}

export type QueryValue = string | number | boolean | undefined | null
export type Query = Record<string, QueryValue>

/** Собирает query-строку, выбрасывая пустые значения (?page=&search= не отправляем). */
export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  /** Объект уйдёт как JSON, FormData — как multipart (заголовок ставит браузер). */
  body?: unknown
  signal?: AbortSignal
}

/* Токен хранится здесь, а не в сторе: http.ts не должен зависеть от Pinia,
   иначе получаем цикл импортов api → store → api. */
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

/** Колбэк для 401: стор авторизации вешает сюда разлогин. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toErrorItems(payload: unknown): ErrorItem[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as ErrorResponse).errors)) {
    return (payload as ErrorResponse).errors.filter(
      (item): item is ErrorItem => !!item && typeof item.message === 'string',
    )
  }
  // Бэкенд может отдать и «голый» формат Yii2: { message, name } — поддержим.
  if (payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string') {
    return [{ message: (payload as { message: string }).message }]
  }
  return []
}

/** Низкоуровневый запрос: возвращает распарсенное тело как есть. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: payload,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, [], defaultMessage(0))
  }

  const parsed = await parseBody(response)

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.()
    throw new ApiError(response.status, toErrorItems(parsed))
  }

  return parsed as T
}

/** Запрос к эндпоинту, который отвечает конвертом { success, data }. */
export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request<SuccessResponse<T>>(path, options)
  return response?.data as T
}
