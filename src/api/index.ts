import type {
  Author,
  AuthorInput,
  AuthorListParams,
  AuthorShort,
  Book,
  BookFormPayload,
  BookInput,
  BookListParams,
  ListData,
  LoginData,
  LoginRequest,
  SmsNotification,
  SubscriptionPayload,
  SubscriptionState,
  TopAuthorsData,
} from '@/types/api'
import { request, requestData, type Query } from './http'


export const authApi = {
  login(credentials: LoginRequest): Promise<LoginData> {
    return requestData<LoginData>('/auth/login', { method: 'POST', body: credentials })
  },
}

function toBookFormData(payload: BookFormPayload): FormData {
  const form = new FormData()
  form.append('title', payload.title)
  form.append('year', String(payload.year))
  if (payload.description) form.append('description', payload.description)
  if (payload.isbn) form.append('isbn', payload.isbn)
  for (const id of payload.author_ids) form.append('author_ids[]', String(id))
  form.append('cover', payload.cover)
  return form
}

export const booksApi = {
  list(params: BookListParams = {}, signal?: AbortSignal): Promise<ListData<Book>> {
    return requestData<ListData<Book>>('/books', { query: params as Query, signal })
  },

  get(id: number, signal?: AbortSignal): Promise<Book> {
    return requestData<Book>(`/books/${id}`, { signal })
  },

  create(payload: BookFormPayload): Promise<Book> {
    return requestData<Book>('/books', { method: 'POST', body: toBookFormData(payload) })
  },

  /** Полное обновление: multipart, обложка обязательна (см. BookForm в спеке). */
  replace(id: number, payload: BookFormPayload): Promise<Book> {
    return requestData<Book>(`/books/${id}`, { method: 'PUT', body: toBookFormData(payload) })
  },

  /** Частичное обновление: JSON, без обложки. */
  update(id: number, payload: BookInput): Promise<Book> {
    return requestData<Book>(`/books/${id}`, { method: 'PATCH', body: payload })
  },

  remove(id: number): Promise<void> {
    return request<void>(`/books/${id}`, { method: 'DELETE' })
  },
}

export const authorsApi = {
  list(params: AuthorListParams = {}, signal?: AbortSignal): Promise<ListData<AuthorShort>> {
    return requestData<ListData<AuthorShort>>('/authors', { query: params as Query, signal })
  },

  get(id: number, signal?: AbortSignal): Promise<Author> {
    return requestData<Author>(`/authors/${id}`, { signal })
  },

  create(payload: AuthorInput): Promise<Author> {
    return requestData<Author>('/authors', { method: 'POST', body: payload })
  },

  update(id: number, payload: AuthorInput): Promise<Author> {
    return requestData<Author>(`/authors/${id}`, { method: 'PUT', body: payload })
  },

  remove(id: number): Promise<void> {
    return request<void>(`/authors/${id}`, { method: 'DELETE' })
  },
}

export const reportsApi = {
  topAuthors(year: number): Promise<TopAuthorsData> {
    return requestData<TopAuthorsData>('/reports/top-authors', { query: { year } })
  },
}

/**
 * Подписка гостя на новинки автора с уведомлением по SMS. В book.yaml этих
 * операций нет — контракт предложен нами, см. api/subscriptions.addendum.yaml.
 */
export const subscriptionsApi = {
  list(phone: string): Promise<ListData<SubscriptionState>> {
    return requestData<ListData<SubscriptionState>>('/subscriptions', { query: { phone } })
  },

  subscribe(authorId: number, payload: SubscriptionPayload): Promise<SubscriptionState> {
    return requestData<SubscriptionState>(`/authors/${authorId}/subscriptions`, {
      method: 'POST',
      body: payload,
    })
  },

  unsubscribe(authorId: number, payload: SubscriptionPayload): Promise<void> {
    return request<void>(`/authors/${authorId}/subscriptions`, { method: 'DELETE', body: payload })
  },
}

/** Журнал отправленных SMS-уведомлений — чтобы подписчик видел, что ему слали. */
export const notificationsApi = {
  list(phone: string): Promise<ListData<SmsNotification>> {
    return requestData<ListData<SmsNotification>>('/notifications', { query: { phone } })
  },
}
