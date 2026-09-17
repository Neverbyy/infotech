import { HttpResponse, delay, http } from 'msw'

import type { Author, AuthorShort, Book, ErrorItem, Pagination } from '@/types/api'
import { normalizePhone } from '@/utils/validation'
import { commit, generateCover, getDb, nextId, type MockAuthor, type MockBook } from './db'
import { newBookMessage, sendSms } from './sms'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

/** Демо-учётка: подсказка выводится на странице входа. */
export const DEMO_CREDENTIALS = { username: 'user', password: 'password' }

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

/** Искусственная задержка, чтобы в демо были заметны состояния загрузки. В тестах выключена. */
const lag = (ms: number) => (import.meta.env.MODE === 'test' ? Promise.resolve() : delay(ms))

/* ── Ответы ─────────────────────────────────────────────────────────────── */

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function fail(status: number, errors: ErrorItem[]) {
  return HttpResponse.json({ success: false, errors }, { status })
}

const UNAUTHORIZED = () => fail(401, [{ message: 'Требуется авторизация' }])
const NOT_FOUND = (message: string) => fail(404, [{ message }])

const BOOK_NOT_FOUND = 'Книга не найдена'
const AUTHOR_NOT_FOUND = 'Автор не найден'

/* ── Авторизация ────────────────────────────────────────────────────────── */

function issueToken(username: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS
  return { token: `mock.${btoa(encodeURIComponent(username))}.${expiresAt}`, expiresAt }
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return false

  const parts = header.slice(7).split('.')
  if (parts.length !== 3 || parts[0] !== 'mock') return false

  const expiresAt = Number(parts[2])
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

/* ── Проекции в формат API ──────────────────────────────────────────────── */

function authorsOf(book: MockBook): AuthorShort[] {
  const { authors } = getDb()
  return book.author_ids
    .map((id) => authors.find((author) => author.id === id))
    .filter((author): author is AuthorShort => !!author)
    .map((author) => ({ id: author.id, full_name: author.full_name }))
}

function toBook(book: MockBook): Book {
  return {
    id: book.id,
    title: book.title,
    year: book.year,
    description: book.description,
    isbn: book.isbn,
    cover_url: book.cover_url,
    authors: authorsOf(book),
  }
}

function toAuthor(id: number): Author | null {
  const db = getDb()
  const author = db.authors.find((item) => item.id === id)
  if (!author) return null
  return {
    id: author.id,
    full_name: author.full_name,
    books: db.books
      .filter((book) => book.author_ids.includes(id))
      .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'ru'))
      .map((book) => ({ id: book.id, title: book.title, year: book.year })),
  }
}

function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; pagination: Pagination } {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = (safePage - 1) * perPage
  return {
    items: items.slice(from, from + perPage),
    pagination: { total, page: safePage, per_page: perPage, total_pages: total === 0 ? 0 : totalPages },
  }
}

function readPaging(url: URL): { page: number; perPage: number } {
  const page = Number(url.searchParams.get('page')) || 1
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per-page')) || 20))
  return { page, perPage }
}

/* ── Валидация книги ──────────────────────────────────────────────────────
   Дублирует правила из src/utils/validation.ts НАМЕРЕННО. Мок играет роль
   независимого бэкенда: сообщения у него свои (клиент обязан показывать
   серверные, а не подставлять собственные), часть проверок клиенту недоступна
   в принципе (уникальность ISBN, существование author_ids), а в проде общей
   реализации нет вовсе — там PHP. С общей функцией 48 контрактных тестов
   превратились бы в тавтологию f(x) === f(x). */

interface BookFields {
  title?: string
  year?: string | number
  description?: string
  isbn?: string
  author_ids?: number[]
}

function validateBook(fields: BookFields, options: { partial: boolean; excludeId?: number }): ErrorItem[] {
  const errors: ErrorItem[] = []
  const db = getDb()

  const required = (key: keyof BookFields) => !options.partial || fields[key] !== undefined

  if (required('title')) {
    const title = (fields.title ?? '').trim()
    if (!title) errors.push({ field: 'title', message: 'Название обязательно для заполнения' })
    else if (title.length > 255) errors.push({ field: 'title', message: 'Название не длиннее 255 символов' })
  }

  if (required('year')) {
    const year = Number(fields.year)
    if (!Number.isInteger(year)) errors.push({ field: 'year', message: 'Год должен быть целым числом' })
    else if (year < 1450 || year > new Date().getFullYear() + 1)
      errors.push({ field: 'year', message: 'Год выходит за допустимые границы' })
  }

  if (required('author_ids')) {
    const ids = fields.author_ids ?? []
    if (ids.length === 0) errors.push({ field: 'author_ids', message: 'Укажите хотя бы одного автора' })
    else {
      const missing = ids.filter((id) => !db.authors.some((author) => author.id === id))
      if (missing.length > 0)
        errors.push({ field: 'author_ids', message: `Авторы не найдены: ${missing.join(', ')}` })
    }
  }

  const isbn = (fields.isbn ?? '').trim()
  if (isbn) {
    const clean = isbn.replace(/[\s-]/g, '').toUpperCase()
    if (!/^(?:\d{9}[\dX]|\d{13})$/.test(clean)) {
      errors.push({ field: 'isbn', message: 'ISBN должен состоять из 10 или 13 символов' })
    } else if (
      db.books.some((book) => book.id !== options.excludeId && book.isbn.replace(/[\s-]/g, '') === clean)
    ) {
      errors.push({ field: 'isbn', message: 'Книга с таким ISBN уже есть в каталоге' })
    }
  }

  return errors
}

function readAuthorIds(form: FormData): number[] {
  const raw = [...form.getAll('author_ids[]'), ...form.getAll('author_ids')]
  return raw
    .flatMap((value) => String(value).split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

/**
 * Загруженную обложку храним как data-URI: «база» мока живёт в localStorage,
 * куда объект File положить нельзя.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  // Порциями, иначе String.fromCharCode переполняет стек на крупных файлах.
  const CHUNK = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }

  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

/* ── SMS-уведомления подписчикам ────────────────────────────────────────── */

/**
 * Рассылает SMS подписчикам авторов новой книги и пишет журнал.
 *
 * Настоящий бэкенд поставил бы задачу в очередь и ответил сразу; мок делает
 * это по ходу запроса, чтобы результат был сразу виден в разделе «Подписки».
 * Сбой шлюза не должен ломать создание книги — он просто попадёт в журнал
 * со статусом failed.
 */
async function notifySubscribers(book: MockBook): Promise<void> {
  const db = getDb()

  // Один номер — одно SMS, даже если подписан на нескольких соавторов книги.
  const targets = new Map<string, MockAuthor>()
  for (const authorId of book.author_ids) {
    const author = db.authors.find((item) => item.id === authorId)
    if (!author) continue
    for (const subscription of db.subscriptions) {
      if (subscription.author_id === authorId && !targets.has(subscription.phone)) {
        targets.set(subscription.phone, author)
      }
    }
  }
  if (targets.size === 0) return

  for (const [phone, author] of targets) {
    const text = newBookMessage(book.title, author.full_name)
    const result = await sendSms(phone, text)

    db.notifications.push({
      id: nextId(db.notifications),
      phone,
      author_id: author.id,
      author_name: author.full_name,
      book_id: book.id,
      book_title: book.title,
      text,
      sent_at: new Date().toISOString(),
      status: result.status,
      details: result.details,
    })
  }

  commit()
}

/* ── Обработчики ────────────────────────────────────────────────────────── */

export const handlers = [
  /* Аутентификация */
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await lag(320)
    const body = (await request.json()) as { username?: string; password?: string }

    const isValid =
      (body.username === DEMO_CREDENTIALS.username && body.password === DEMO_CREDENTIALS.password) ||
      (body.username === 'admin' && body.password === 'admin')

    if (!isValid) return fail(401, [{ message: 'Неверный логин или пароль' }])

    const { token, expiresAt } = issueToken(body.username!)
    return ok({
      token,
      expires_at: new Date(expiresAt).toISOString(),
      user: { id: 1, username: body.username, role: 'user' },
    })
  }),

  /* Книги */
  http.get(`${BASE}/books`, async ({ request }) => {
    await lag(220)
    const url = new URL(request.url)
    const db = getDb()

    const authorId = Number(url.searchParams.get('author_id')) || null
    const year = Number(url.searchParams.get('year')) || null
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()

    let found = [...db.books]
    if (authorId) found = found.filter((book) => book.author_ids.includes(authorId))
    if (year) found = found.filter((book) => book.year === year)
    if (search) {
      found = found.filter((book) => {
        const haystack = [book.title, book.isbn, ...authorsOf(book).map((author) => author.full_name)]
          .join(' ')
          .toLowerCase()
        return haystack.includes(search)
      })
    }

    found.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'ru'))

    const { page, perPage } = readPaging(url)
    return ok(paginate(found.map(toBook), page, perPage))
  }),

  http.post(`${BASE}/books`, async ({ request }) => {
    await lag(420)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const form = await request.formData()
    const cover = form.get('cover')
    const fields: BookFields = {
      title: String(form.get('title') ?? ''),
      year: String(form.get('year') ?? ''),
      description: String(form.get('description') ?? ''),
      isbn: String(form.get('isbn') ?? ''),
      author_ids: readAuthorIds(form),
    }

    const errors = validateBook(fields, { partial: false })
    if (!(cover instanceof File) || cover.size === 0) {
      errors.push({ field: 'cover', message: 'Загрузите обложку книги' })
    }
    if (errors.length > 0) return fail(422, errors)

    const db = getDb()
    const book: MockBook = {
      id: nextId(db.books),
      title: fields.title!.trim(),
      year: Number(fields.year),
      description: fields.description?.trim() ?? '',
      isbn: fields.isbn?.trim() ?? '',
      cover_url: await fileToDataUrl(cover as File),
      author_ids: fields.author_ids ?? [],
    }
    db.books.push(book)
    commit()

    // Новинка автора — повод разослать SMS подписчикам.
    await notifySubscribers(book)

    return ok(toBook(book), 201)
  }),

  http.get(`${BASE}/books/:id`, async ({ params }) => {
    await lag(200)
    const book = getDb().books.find((item) => item.id === Number(params.id))
    return book ? ok(toBook(book)) : NOT_FOUND(BOOK_NOT_FOUND)
  }),

  http.put(`${BASE}/books/:id`, async ({ request, params }) => {
    await lag(420)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const db = getDb()
    const book = db.books.find((item) => item.id === Number(params.id))
    if (!book) return NOT_FOUND(BOOK_NOT_FOUND)

    const form = await request.formData()
    const cover = form.get('cover')
    const fields: BookFields = {
      title: String(form.get('title') ?? ''),
      year: String(form.get('year') ?? ''),
      description: String(form.get('description') ?? ''),
      isbn: String(form.get('isbn') ?? ''),
      author_ids: readAuthorIds(form),
    }

    const errors = validateBook(fields, { partial: false, excludeId: book.id })
    if (!(cover instanceof File) || cover.size === 0) {
      errors.push({ field: 'cover', message: 'Загрузите обложку книги' })
    }
    if (errors.length > 0) return fail(422, errors)

    book.title = fields.title!.trim()
    book.year = Number(fields.year)
    book.description = fields.description?.trim() ?? ''
    book.isbn = fields.isbn?.trim() ?? ''
    book.author_ids = fields.author_ids ?? []
    book.cover_url = await fileToDataUrl(cover as File)
    commit()

    return ok(toBook(book))
  }),

  http.patch(`${BASE}/books/:id`, async ({ request, params }) => {
    await lag(380)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const db = getDb()
    const book = db.books.find((item) => item.id === Number(params.id))
    if (!book) return NOT_FOUND(BOOK_NOT_FOUND)

    const body = (await request.json()) as BookFields
    const errors = validateBook(body, { partial: true, excludeId: book.id })
    if (errors.length > 0) return fail(422, errors)

    if (body.title !== undefined) book.title = String(body.title).trim()
    if (body.year !== undefined) book.year = Number(body.year)
    if (body.description !== undefined) book.description = String(body.description).trim()
    if (body.isbn !== undefined) book.isbn = String(body.isbn).trim()
    if (body.author_ids !== undefined) book.author_ids = body.author_ids

    // Обложку-заглушку перерисовываем под новое название; загруженный файл не трогаем.
    if (book.cover_url.startsWith('data:image/svg+xml')) {
      book.cover_url = generateCover(book.title, authorsOf(book)[0]?.full_name ?? '')
    }
    commit()

    return ok(toBook(book))
  }),

  http.delete(`${BASE}/books/:id`, async ({ request, params }) => {
    await lag(300)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const db = getDb()
    const id = Number(params.id)
    const index = db.books.findIndex((item) => item.id === id)
    if (index === -1) return NOT_FOUND(BOOK_NOT_FOUND)

    db.books.splice(index, 1)

    // Уведомления об этой книге остаются — SMS уже ушло. Но ссылке вести
    // некуда, поэтому обнуляем идентификатор; название хранится отдельно.
    for (const notification of db.notifications) {
      if (notification.book_id === id) notification.book_id = null
    }

    commit()
    return new HttpResponse(null, { status: 204 })
  }),

  /* Авторы */
  http.get(`${BASE}/authors`, async ({ request }) => {
    await lag(200)
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()

    let found = [...getDb().authors]
    if (search) found = found.filter((author) => author.full_name.toLowerCase().includes(search))
    found.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))

    const { page, perPage } = readPaging(url)
    return ok(paginate(found, page, perPage))
  }),

  http.post(`${BASE}/authors`, async ({ request }) => {
    await lag(340)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const body = (await request.json()) as { full_name?: string }
    const fullName = (body.full_name ?? '').trim()

    const db = getDb()
    if (!fullName) return fail(422, [{ field: 'full_name', message: 'ФИО обязательно для заполнения' }])
    if (db.authors.some((author) => author.full_name.toLowerCase() === fullName.toLowerCase()))
      return fail(422, [{ field: 'full_name', message: 'Такой автор уже есть в каталоге' }])

    const author = { id: nextId(db.authors), full_name: fullName }
    db.authors.push(author)
    commit()

    return ok({ ...author, books: [] }, 201)
  }),

  http.get(`${BASE}/authors/:id`, async ({ params }) => {
    await lag(200)
    const author = toAuthor(Number(params.id))
    return author ? ok(author) : NOT_FOUND(AUTHOR_NOT_FOUND)
  }),

  http.put(`${BASE}/authors/:id`, async ({ request, params }) => {
    await lag(340)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const db = getDb()
    const author = db.authors.find((item) => item.id === Number(params.id))
    if (!author) return NOT_FOUND(AUTHOR_NOT_FOUND)

    const body = (await request.json()) as { full_name?: string }
    const fullName = (body.full_name ?? '').trim()
    if (!fullName) return fail(422, [{ field: 'full_name', message: 'ФИО обязательно для заполнения' }])
    if (
      db.authors.some(
        (item) => item.id !== author.id && item.full_name.toLowerCase() === fullName.toLowerCase(),
      )
    )
      return fail(422, [{ field: 'full_name', message: 'Такой автор уже есть в каталоге' }])

    author.full_name = fullName
    commit()

    return ok(toAuthor(author.id))
  }),

  http.delete(`${BASE}/authors/:id`, async ({ request, params }) => {
    await lag(300)
    if (!isAuthorized(request)) return UNAUTHORIZED()

    const db = getDb()
    const id = Number(params.id)
    const index = db.authors.findIndex((item) => item.id === id)
    if (index === -1) return NOT_FOUND(AUTHOR_NOT_FOUND)

    const linked = db.books.filter((book) => book.author_ids.includes(id))
    // У книги должен остаться хотя бы один автор — иначе удаление запрещено.
    const orphaned = linked.filter((book) => book.author_ids.length === 1)
    if (orphaned.length > 0) {
      return fail(422, [
        {
          message: `Нельзя удалить автора: он единственный у ${orphaned.length} книг. Сначала измените эти книги.`,
        },
      ])
    }

    for (const book of linked) book.author_ids = book.author_ids.filter((value) => value !== id)
    db.authors.splice(index, 1)
    db.subscriptions = db.subscriptions.filter((item) => item.author_id !== id)

    // Журнал переживает удаление автора, но ссылаться на него больше нельзя.
    for (const notification of db.notifications) {
      if (notification.author_id === id) notification.author_id = null
    }

    commit()

    return new HttpResponse(null, { status: 204 })
  }),

  /* Отчёт */
  http.get(`${BASE}/reports/top-authors`, async ({ request }) => {
    await lag(260)
    const url = new URL(request.url)
    const raw = url.searchParams.get('year')
    const year = Number(raw)

    if (!raw || !Number.isInteger(year) || year < 1450 || year > new Date().getFullYear() + 1) {
      return fail(400, [{ field: 'year', message: 'Укажите корректный год в параметре year' }])
    }

    const db = getDb()
    const counts = new Map<number, number>()
    for (const book of db.books) {
      if (book.year !== year) continue
      for (const authorId of book.author_ids) counts.set(authorId, (counts.get(authorId) ?? 0) + 1)
    }

    const items = [...counts.entries()]
      .map(([authorId, booksCount]) => ({
        author_id: authorId,
        full_name: db.authors.find((author) => author.id === authorId)?.full_name ?? `Автор #${authorId}`,
        books_count: booksCount,
      }))
      .sort((a, b) => b.books_count - a.books_count || a.full_name.localeCompare(b.full_name, 'ru'))
      .slice(0, 10)
      .map((item, index) => ({ rank: index + 1, ...item }))

    return ok({ year, items })
  }),

  /* Подписки и SMS-уведомления (расширение спеки) */
  http.get(`${BASE}/subscriptions`, async ({ request }) => {
    await lag(180)
    const url = new URL(request.url)
    const phone = normalizePhone(url.searchParams.get('phone') ?? '')
    if (!phone) return fail(400, [{ field: 'phone', message: 'Укажите номер телефона' }])

    const db = getDb()
    const items = db.subscriptions
      .filter((item) => item.phone === phone)
      .map((item) => ({
        ...item,
        full_name: db.authors.find((author) => author.id === item.author_id)?.full_name ?? '',
      }))

    return ok({
      items,
      pagination: { total: items.length, page: 1, per_page: items.length || 1, total_pages: 1 },
    })
  }),

  http.post(`${BASE}/authors/:id/subscriptions`, async ({ request, params }) => {
    await lag(300)
    const db = getDb()
    const authorId = Number(params.id)
    const author = db.authors.find((item) => item.id === authorId)
    if (!author) return NOT_FOUND(AUTHOR_NOT_FOUND)

    const body = (await request.json()) as { phone?: string }
    const phone = normalizePhone(body.phone ?? '')
    if (!/^7\d{10}$/.test(phone))
      return fail(422, [{ field: 'phone', message: 'Некорректный номер телефона' }])

    const existing = db.subscriptions.find((item) => item.author_id === authorId && item.phone === phone)
    const subscription = existing ?? { author_id: authorId, phone, subscribed_at: new Date().toISOString() }
    if (!existing) {
      db.subscriptions.push(subscription)
      commit()
    }

    return ok({ ...subscription, full_name: author.full_name }, existing ? 200 : 201)
  }),

  http.delete(`${BASE}/authors/:id/subscriptions`, async ({ request, params }) => {
    await lag(260)
    const db = getDb()
    const authorId = Number(params.id)
    const body = (await request.json().catch(() => ({}))) as { phone?: string }
    const phone = normalizePhone(body.phone ?? '')

    const index = db.subscriptions.findIndex((item) => item.author_id === authorId && item.phone === phone)
    if (index === -1) return NOT_FOUND('Подписка не найдена')

    db.subscriptions.splice(index, 1)
    commit()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE}/notifications`, async ({ request }) => {
    await lag(180)
    const url = new URL(request.url)
    const phone = normalizePhone(url.searchParams.get('phone') ?? '')
    if (!phone) return fail(400, [{ field: 'phone', message: 'Укажите номер телефона' }])

    const items = getDb()
      .notifications.filter((item) => item.phone === phone)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at))

    return ok({
      items,
      pagination: { total: items.length, page: 1, per_page: items.length || 1, total_pages: 1 },
    })
  }),
]
