/**
 * Типы ответов и запросов API. Один в один с components.schemas из book.yaml.
 * Единственное, чего нет в спеке, — подписка на новинки автора (см. SubscriptionState
 * и раздел «Расхождения со спецификацией» в README).
 */

/** Конверт успешного ответа: { success: true, data: ... } */
export interface SuccessResponse<T> {
  success: true
  data: T
}

export interface ErrorItem {
  field?: string
  message: string
}

/** Конверт ошибки: { success: false, errors: [...] } */
export interface ErrorResponse {
  success: false
  errors: ErrorItem[]
}

export interface Pagination {
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ListData<T> {
  items: T[]
  pagination: Pagination
}

export interface AuthorShort {
  id: number
  full_name: string
}

export interface BookShort {
  id: number
  title: string
  year: number
}

export interface Book {
  id: number
  title: string
  year: number
  description?: string
  isbn?: string
  cover_url?: string
  authors: AuthorShort[]
}

export interface Author {
  id: number
  full_name: string
  books: BookShort[]
}

/** Тело PATCH /books/{id} — все поля опциональны. */
export interface BookInput {
  title?: string
  year?: number
  description?: string
  isbn?: string
  author_ids?: number[]
}

/** Тело POST/PUT /books (multipart/form-data) — обложка обязательна. */
export interface BookFormPayload {
  title: string
  year: number
  description?: string
  isbn?: string
  author_ids: number[]
  cover: File
}

export interface AuthorInput {
  full_name: string
}

export interface User {
  id: number
  username: string
  role: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginData {
  token: string
  expires_at: string
  user: User
}

export interface TopAuthor {
  rank: number
  author_id: number
  full_name: string
  books_count: number
}

export interface TopAuthorsData {
  year: number
  items: TopAuthor[]
}

/** Параметры GET /books. Имя `per-page` — как в спеке (Yii2-стиль). */
export interface BookListParams {
  page?: number
  'per-page'?: number
  author_id?: number
  year?: number
  search?: string
}

export interface AuthorListParams {
  page?: number
  'per-page'?: number
  search?: string
}

/* ── Подписки и SMS: в book.yaml их нет, эндпоинты предложены нами ─────── */

export interface SubscriptionPayload {
  /** Номер в формате шлюза: 11 цифр, начинается с 7 (79991234567). */
  phone: string
}

export interface SubscriptionState {
  author_id: number
  full_name: string
  phone: string
  subscribed_at: string
}

/**
 * Запись в журнале SMS-уведомлений о новинке автора.
 *
 * Отправленное SMS — исторический факт: запись живёт дальше, даже если книгу
 * или автора удалили. Поэтому имена продублированы (author_name, book_title),
 * а ссылочные идентификаторы обнуляются — вести им уже некуда.
 */
export interface SmsNotification {
  id: number
  phone: string
  /** null — автора удалили из каталога. */
  author_id: number | null
  author_name: string
  /** null — книгу удалили из каталога. */
  book_id: number | null
  book_title: string
  text: string
  sent_at: string
  status: 'sent' | 'failed'
  /** server_id из ответа шлюза либо текст ошибки. */
  details?: string
}
