// @vitest-environment node
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Хендлеры описаны относительными путями (/api/v1/...), а MSW достраивает их
// до абсолютных через location. В node-окружении его нет — подставляем.
// vi.hoisted гарантирует, что это выполнится до импорта handlers.
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'location', {
    value: new URL('http://localhost/'),
    configurable: true,
    writable: true,
  })
})

import type {
  Author,
  Book,
  ErrorResponse,
  ListData,
  LoginData,
  SmsNotification,
  SuccessResponse,
  TopAuthorsData,
} from '@/types/api'
import { resetDb } from './db'
import { DEMO_CREDENTIALS, handlers } from './handlers'

/**
 * Контрактные тесты мока: проверяют, что он отвечает так же, как описано
 * в api/book.yaml, — конверт { success, data }, коды 401/404/422/400 и пагинация.
 *
 * Окружение node, а не jsdom: File из jsdom нельзя передать в fetch Node,
 * и запрос с multipart-обложкой зависает. В браузере такой проблемы нет,
 * потому что там File и fetch — из одной реализации.
 */

const server = setupServer(...handlers)
const API = 'http://localhost/api/v1'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// localStorage в node-окружении нет — db.ts это учитывает и просто держит данные в памяти.
beforeEach(() => resetDb())

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function login(): Promise<string> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO_CREDENTIALS),
  })
  const body = await json<SuccessResponse<LoginData>>(response)
  return body.data.token
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function bookForm(overrides: Record<string, string> = {}, authorIds: number[] = [1]): FormData {
  const form = new FormData()
  const fields = { title: 'Новая книга', year: '2024', description: 'Описание', ...overrides }
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  for (const id of authorIds) form.append('author_ids[]', String(id))
  form.append('cover', new File(['fake-image-bytes'], 'cover.png', { type: 'image/png' }))
  return form
}

describe('POST /auth/login', () => {
  it('выдаёт токен и данные пользователя', async () => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEMO_CREDENTIALS),
    })
    const body = await json<SuccessResponse<LoginData>>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.token).toMatch(/^mock\./)
    expect(body.data.user.role).toBe('user')
    expect(new Date(body.data.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('отвечает 401 на неверный пароль', async () => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user', password: 'nope' }),
    })
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.errors[0]?.message).toBe('Неверный логин или пароль')
  })
})

describe('GET /books', () => {
  it('отдаёт список с пагинацией', async () => {
    const response = await fetch(`${API}/books?page=1&per-page=5`)
    const body = await json<SuccessResponse<ListData<Book>>>(response)

    expect(response.status).toBe(200)
    expect(body.data.items).toHaveLength(5)
    expect(body.data.pagination.per_page).toBe(5)
    expect(body.data.pagination.total).toBeGreaterThan(5)
    expect(body.data.pagination.total_pages).toBe(Math.ceil(body.data.pagination.total / 5))
  })

  it('отдаёт вторую страницу без пересечения с первой', async () => {
    const first = await json<SuccessResponse<ListData<Book>>>(await fetch(`${API}/books?page=1&per-page=4`))
    const second = await json<SuccessResponse<ListData<Book>>>(await fetch(`${API}/books?page=2&per-page=4`))

    const firstIds = first.data.items.map((item) => item.id)
    const secondIds = second.data.items.map((item) => item.id)
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false)
  })

  it('фильтрует по автору', async () => {
    const response = await fetch(`${API}/books?author_id=3&per-page=100`)
    const body = await json<SuccessResponse<ListData<Book>>>(response)

    expect(body.data.items.length).toBeGreaterThan(0)
    for (const item of body.data.items) {
      expect(item.authors.map((author) => author.id)).toContain(3)
    }
  })

  it('фильтрует по году', async () => {
    const response = await fetch(`${API}/books?year=2023&per-page=100`)
    const body = await json<SuccessResponse<ListData<Book>>>(response)

    expect(body.data.items.length).toBeGreaterThan(0)
    expect(body.data.items.every((item) => item.year === 2023)).toBe(true)
  })

  it('ищет по названию и по ФИО автора', async () => {
    const byTitle = await json<SuccessResponse<ListData<Book>>>(await fetch(`${API}/books?search=Лавр`))
    expect(byTitle.data.items[0]?.title).toBe('Лавр')

    const byAuthor = await json<SuccessResponse<ListData<Book>>>(
      await fetch(`${API}/books?search=${encodeURIComponent('Пелевин')}&per-page=100`),
    )
    expect(byAuthor.data.items.length).toBeGreaterThan(0)
    expect(
      byAuthor.data.items.every((item) =>
        item.authors.some((author) => author.full_name.includes('Пелевин')),
      ),
    ).toBe(true)
  })

  it('возвращает пустой список и total_pages = 0, когда ничего не найдено', async () => {
    const body = await json<SuccessResponse<ListData<Book>>>(await fetch(`${API}/books?search=zzzzz`))

    expect(body.data.items).toEqual([])
    expect(body.data.pagination.total).toBe(0)
    expect(body.data.pagination.total_pages).toBe(0)
  })
})

describe('GET /books/{id}', () => {
  it('возвращает книгу с авторами', async () => {
    const body = await json<SuccessResponse<Book>>(await fetch(`${API}/books/1`))

    expect(body.data.id).toBe(1)
    expect(body.data.authors.length).toBeGreaterThan(0)
    expect(body.data.cover_url).toMatch(/^data:image\/svg\+xml/)
  })

  it('отвечает 404 на несуществующий id', async () => {
    const response = await fetch(`${API}/books/9999`)
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(404)
    expect(body.errors[0]?.message).toBe('Книга не найдена')
  })
})

describe('POST /books', () => {
  it('без токена отвечает 401', async () => {
    const response = await fetch(`${API}/books`, { method: 'POST', body: bookForm() })
    expect(response.status).toBe(401)
  })

  it('создаёт книгу и возвращает 201', async () => {
    const token = await login()
    const response = await fetch(`${API}/books`, {
      method: 'POST',
      headers: authHeaders(token),
      body: bookForm({ title: 'Тестовая книга', year: '2024' }, [1, 2]),
    })
    const body = await json<SuccessResponse<Book>>(response)

    expect(response.status).toBe(201)
    expect(body.data.title).toBe('Тестовая книга')
    expect(body.data.authors.map((author) => author.id)).toEqual([1, 2])
    expect(body.data.cover_url).toMatch(/^data:image\/png/)
  })

  it('возвращает 422 с привязкой ошибок к полям', async () => {
    const token = await login()
    const form = new FormData()
    form.append('title', '')
    form.append('year', 'не год')

    const response = await fetch(`${API}/books`, { method: 'POST', headers: authHeaders(token), body: form })
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(422)
    const fields = body.errors.map((error) => error.field)
    expect(fields).toContain('title')
    expect(fields).toContain('year')
    expect(fields).toContain('author_ids')
    expect(fields).toContain('cover')
  })

  it('не пропускает дубликат ISBN', async () => {
    const token = await login()
    const existing = await json<SuccessResponse<Book>>(await fetch(`${API}/books/1`))

    const response = await fetch(`${API}/books`, {
      method: 'POST',
      headers: authHeaders(token),
      body: bookForm({ isbn: existing.data.isbn! }),
    })
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(422)
    expect(body.errors[0]?.field).toBe('isbn')
  })
})

describe('PATCH /books/{id}', () => {
  it('меняет только переданные поля', async () => {
    const token = await login()
    const before = await json<SuccessResponse<Book>>(await fetch(`${API}/books/1`))

    const response = await fetch(`${API}/books/1`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Новое описание' }),
    })
    const body = await json<SuccessResponse<Book>>(response)

    expect(response.status).toBe(200)
    expect(body.data.description).toBe('Новое описание')
    expect(body.data.title).toBe(before.data.title)
    expect(body.data.year).toBe(before.data.year)
  })

  it('без токена отвечает 401', async () => {
    const response = await fetch(`${API}/books/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Взлом' }),
    })
    expect(response.status).toBe(401)
  })
})

describe('PUT /books/{id}', () => {
  it('заменяет книгу целиком вместе с обложкой', async () => {
    const token = await login()
    const response = await fetch(`${API}/books/1`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: bookForm({ title: 'Полностью новая', year: '2020', isbn: '' }, [4]),
    })
    const body = await json<SuccessResponse<Book>>(response)

    expect(response.status).toBe(200)
    expect(body.data.title).toBe('Полностью новая')
    expect(body.data.authors.map((author) => author.id)).toEqual([4])
    expect(body.data.cover_url).toMatch(/^data:image\/png/)
  })
})

describe('DELETE /books/{id}', () => {
  it('удаляет книгу и отвечает 204', async () => {
    const token = await login()
    const response = await fetch(`${API}/books/2`, { method: 'DELETE', headers: authHeaders(token) })

    expect(response.status).toBe(204)
    expect((await fetch(`${API}/books/2`)).status).toBe(404)
  })

  it('без токена отвечает 401 и книгу не трогает', async () => {
    const response = await fetch(`${API}/books/2`, { method: 'DELETE' })

    expect(response.status).toBe(401)
    expect((await fetch(`${API}/books/2`)).status).toBe(200)
  })
})

describe('/authors', () => {
  it('отдаёт авторов, отсортированных по алфавиту', async () => {
    const body = await json<SuccessResponse<ListData<{ id: number; full_name: string }>>>(
      await fetch(`${API}/authors?per-page=100`),
    )
    const names = body.data.items.map((item) => item.full_name)

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')))
  })

  it('ищет по ФИО', async () => {
    const body = await json<SuccessResponse<ListData<{ full_name: string }>>>(
      await fetch(`${API}/authors?search=${encodeURIComponent('Стругацкий')}`),
    )

    expect(body.data.items).toHaveLength(2)
  })

  it('возвращает автора вместе с его книгами', async () => {
    const body = await json<SuccessResponse<Author>>(await fetch(`${API}/authors/3`))

    expect(body.data.books.length).toBeGreaterThan(0)
    expect(body.data.books[0]).toHaveProperty('year')
  })

  it('не создаёт дубликат автора', async () => {
    const token = await login()
    const response = await fetch(`${API}/authors`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Пелевин Виктор Олегович' }),
    })
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(422)
    expect(body.errors[0]?.field).toBe('full_name')
  })

  it('создаёт нового автора', async () => {
    const token = await login()
    const response = await fetch(`${API}/authors`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Новый Автор Тестович' }),
    })
    const body = await json<SuccessResponse<Author>>(response)

    expect(response.status).toBe(201)
    expect(body.data.full_name).toBe('Новый Автор Тестович')
    expect(body.data.books).toEqual([])
  })

  it('не даёт удалить автора, если он единственный у книги', async () => {
    const token = await login()
    const response = await fetch(`${API}/authors/3`, { method: 'DELETE', headers: authHeaders(token) })

    expect(response.status).toBe(422)
  })

  it('удаляет автора, у книг которого есть соавторы', async () => {
    const token = await login()
    const response = await fetch(`${API}/authors/1`, { method: 'DELETE', headers: authHeaders(token) })

    expect(response.status).toBe(204)

    // Книга остаётся, но уже без удалённого автора.
    const book = await json<SuccessResponse<Book>>(await fetch(`${API}/books/1`))
    expect(book.data.authors.map((author) => author.id)).not.toContain(1)
    expect(book.data.authors.length).toBeGreaterThan(0)
  })
})

describe('GET /reports/top-authors', () => {
  it('без параметра year отвечает 400', async () => {
    const response = await fetch(`${API}/reports/top-authors`)
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(400)
    expect(body.errors[0]?.field).toBe('year')
  })

  it('на некорректный year отвечает 400', async () => {
    expect((await fetch(`${API}/reports/top-authors?year=abc`)).status).toBe(400)
    expect((await fetch(`${API}/reports/top-authors?year=3000`)).status).toBe(400)
  })

  it('строит рейтинг по убыванию с не более чем 10 позициями', async () => {
    const body = await json<SuccessResponse<TopAuthorsData>>(
      await fetch(`${API}/reports/top-authors?year=2023`),
    )

    expect(body.data.year).toBe(2023)
    expect(body.data.items.length).toBeGreaterThan(0)
    expect(body.data.items.length).toBeLessThanOrEqual(10)
    expect(body.data.items[0]?.rank).toBe(1)

    const counts = body.data.items.map((item) => item.books_count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    body.data.items.forEach((item, index) => expect(item.rank).toBe(index + 1))
  })

  it('учитывает каждого соавтора отдельно', async () => {
    const body = await json<SuccessResponse<TopAuthorsData>>(
      await fetch(`${API}/reports/top-authors?year=2024`),
    )
    const names = body.data.items.map((item) => item.full_name)

    // «Vita Nostra» 2024 года написана Мариной и Сергеем Дяченко — оба в рейтинге.
    expect(names).toContain('Дяченко Марина Юрьевна')
    expect(names).toContain('Дяченко Сергей Сергеевич')
  })

  it('возвращает пустой рейтинг за год без книг', async () => {
    const body = await json<SuccessResponse<TopAuthorsData>>(
      await fetch(`${API}/reports/top-authors?year=1999`),
    )
    expect(body.data.items).toEqual([])
  })
})

describe('подписки и SMS-уведомления', () => {
  const PHONE = '79991234567'
  const OTHER_PHONE = '79005554433'

  /** Заглушка шлюза SMSPILOT: в тестах наружу не ходим и проверяем сам запрос. */
  function stubGateway(
    payload: Record<string, unknown> = {
      send: [{ server_id: '9316849', phone: PHONE, price: '1.31', status: '0' }],
      balance: '2935.50',
      cost: '1.31',
    },
  ): URL[] {
    const calls: URL[] = []
    server.use(
      http.get('/sms-gateway', ({ request }) => {
        calls.push(new URL(request.url))
        return HttpResponse.json(payload)
      }),
    )
    return calls
  }

  function subscribe(authorId: number, phone: string): Promise<Response> {
    return fetch(`${API}/authors/${authorId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
  }

  async function createBook(title: string, authorIds: number[]): Promise<Response> {
    const token = await login()
    return fetch(`${API}/books`, {
      method: 'POST',
      headers: authHeaders(token),
      body: bookForm({ title, year: '2025' }, authorIds),
    })
  }

  it('оформляет подписку гостю без авторизации', async () => {
    expect((await subscribe(5, PHONE)).status).toBe(201)
  })

  it('идемпотентна при повторной подписке', async () => {
    expect((await subscribe(5, PHONE)).status).toBe(201)
    expect((await subscribe(5, PHONE)).status).toBe(200)

    const list = await json<SuccessResponse<ListData<{ author_id: number }>>>(
      await fetch(`${API}/subscriptions?phone=${PHONE}`),
    )
    expect(list.data.items).toHaveLength(1)
  })

  it('считает +7…, 8… и 7… одним подписчиком', async () => {
    expect((await subscribe(5, '+7 (999) 123-45-67')).status).toBe(201)
    expect((await subscribe(5, '8 999 123 45 67')).status).toBe(200)

    const list = await json<SuccessResponse<ListData<{ phone: string }>>>(
      await fetch(`${API}/subscriptions?phone=${PHONE}`),
    )
    expect(list.data.items).toHaveLength(1)
    expect(list.data.items[0]?.phone).toBe(PHONE)
  })

  it('отвергает некорректный номер', async () => {
    const response = await subscribe(5, '123')
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(422)
    expect(body.errors[0]?.field).toBe('phone')
  })

  it('отписывает и отвечает 204', async () => {
    await subscribe(5, PHONE)

    const response = await fetch(`${API}/authors/5/subscriptions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE }),
    })
    expect(response.status).toBe(204)

    const list = await json<SuccessResponse<ListData<unknown>>>(
      await fetch(`${API}/subscriptions?phone=${PHONE}`),
    )
    expect(list.data.items).toEqual([])
  })

  it('возвращает ФИО автора в списке подписок', async () => {
    await subscribe(5, PHONE)

    const list = await json<SuccessResponse<ListData<{ full_name: string }>>>(
      await fetch(`${API}/subscriptions?phone=${PHONE}`),
    )
    expect(list.data.items[0]?.full_name).toBe('Рубина Дина Ильинична')
  })

  it('шлёт SMS подписчику, когда у автора выходит новая книга', async () => {
    const calls = stubGateway()
    await subscribe(1, PHONE)

    expect((await createBook('Новая повесть', [1])).status).toBe(201)

    expect(calls).toHaveLength(1)
    const query = calls[0]!.searchParams
    expect(query.get('to')).toBe(PHONE)
    expect(query.get('send')).toContain('Новая повесть')
    expect(query.get('send')).toContain('Стругацкий Аркадий Натанович')
    expect(query.get('format')).toBe('json')
    expect(query.get('apikey')).toBeTruthy()
  })

  it('молчит, когда на автора никто не подписан', async () => {
    const calls = stubGateway()

    await createBook('Никем не ожидаемая', [1])

    expect(calls).toHaveLength(0)
  })

  it('шлёт одно SMS на номер, подписанный сразу на двух соавторов', async () => {
    const calls = stubGateway()
    await subscribe(1, PHONE)
    await subscribe(2, PHONE)

    await createBook('Совместная', [1, 2])

    expect(calls).toHaveLength(1)
  })

  it('шлёт SMS каждому подписчику автора', async () => {
    const calls = stubGateway()
    await subscribe(1, PHONE)
    await subscribe(1, OTHER_PHONE)

    await createBook('Для двоих', [1])

    expect(calls.map((url) => url.searchParams.get('to')).sort()).toEqual([OTHER_PHONE, PHONE].sort())
  })

  it('не шлёт SMS при обновлении книги — новинка только одна', async () => {
    await subscribe(1, PHONE)
    const calls = stubGateway()

    const token = await login()
    await fetch(`${API}/books/1`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: bookForm({ title: 'Переименованная' }, [1]),
    })

    expect(calls).toHaveLength(0)
  })

  it('пишет журнал уведомлений и отдаёт его по номеру', async () => {
    stubGateway()
    await subscribe(1, PHONE)

    await createBook('Журнальная', [1])

    const log = await json<SuccessResponse<ListData<SmsNotification>>>(
      await fetch(`${API}/notifications?phone=${PHONE}`),
    )

    expect(log.data.items).toHaveLength(1)
    const entry = log.data.items[0]!
    expect(entry.status).toBe('sent')
    expect(entry.book_title).toBe('Журнальная')
    expect(entry.author_name).toBe('Стругацкий Аркадий Натанович')
    expect(entry.details).toContain('9316849')
  })

  it('записывает сбой шлюза, но книгу всё равно создаёт', async () => {
    stubGateway({
      error: { code: '111', description: 'Invalid phone', description_ru: 'Неправильный номер телефона' },
    })
    await subscribe(1, PHONE)

    expect((await createBook('Несмотря на сбой', [1])).status).toBe(201)

    const log = await json<SuccessResponse<ListData<SmsNotification>>>(
      await fetch(`${API}/notifications?phone=${PHONE}`),
    )
    expect(log.data.items[0]?.status).toBe('failed')
    expect(log.data.items[0]?.details).toContain('Неправильный номер телефона')
  })

  it('требует номер для выдачи журнала', async () => {
    expect((await fetch(`${API}/notifications`)).status).toBe(400)
  })

  it('переживает удаление книги: запись остаётся, ссылка обнуляется', async () => {
    stubGateway()
    await subscribe(1, PHONE)

    const created = await json<SuccessResponse<Book>>(await createBook('Недолгая', [1]))
    const token = await login()
    expect(
      (await fetch(`${API}/books/${created.data.id}`, { method: 'DELETE', headers: authHeaders(token) }))
        .status,
    ).toBe(204)

    const log = await json<SuccessResponse<ListData<SmsNotification>>>(
      await fetch(`${API}/notifications?phone=${PHONE}`),
    )
    const entry = log.data.items[0]!

    expect(log.data.items).toHaveLength(1)
    expect(entry.book_id).toBeNull()
    // Название сохранено отдельно, поэтому запись остаётся читаемой.
    expect(entry.book_title).toBe('Недолгая')
    expect(entry.text).toContain('Недолгая')
  })

  it('переживает удаление автора: ссылка на автора обнуляется', async () => {
    stubGateway()
    await subscribe(1, PHONE)
    await createBook('Совместная', [1, 2])

    const token = await login()
    // У автора 1 все книги в соавторстве, поэтому удаление разрешено.
    expect((await fetch(`${API}/authors/1`, { method: 'DELETE', headers: authHeaders(token) })).status).toBe(
      204,
    )

    const log = await json<SuccessResponse<ListData<SmsNotification>>>(
      await fetch(`${API}/notifications?phone=${PHONE}`),
    )
    const entry = log.data.items[0]!

    expect(entry.author_id).toBeNull()
    expect(entry.author_name).toBe('Стругацкий Аркадий Натанович')
  })

  it('не трогает записи о других книгах при удалении', async () => {
    stubGateway()
    await subscribe(1, PHONE)

    const first = await json<SuccessResponse<Book>>(await createBook('Первая', [1]))
    await createBook('Вторая', [1])

    const token = await login()
    await fetch(`${API}/books/${first.data.id}`, { method: 'DELETE', headers: authHeaders(token) })

    const log = await json<SuccessResponse<ListData<SmsNotification>>>(
      await fetch(`${API}/notifications?phone=${PHONE}`),
    )
    const byTitle = new Map(log.data.items.map((item) => [item.book_title, item]))

    expect(byTitle.get('Первая')?.book_id).toBeNull()
    expect(byTitle.get('Вторая')?.book_id).not.toBeNull()
  })
})
