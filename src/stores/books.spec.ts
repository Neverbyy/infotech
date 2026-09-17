import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { booksApi } from '@/api'
import { ApiError } from '@/api/http'
import type { Book, ListData } from '@/types/api'
import { DEFAULT_PER_PAGE, useBooksStore } from './books'

vi.mock('@/api', () => ({
  booksApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const api = vi.mocked(booksApi)

const book = (overrides: Partial<Book> = {}): Book => ({
  id: 1,
  title: 'Пикник на обочине',
  year: 2021,
  description: '',
  isbn: '',
  cover_url: '',
  authors: [{ id: 1, full_name: 'Стругацкий Аркадий Натанович' }],
  ...overrides,
})

const listData = (items: Book[], total = items.length): ListData<Book> => ({
  items,
  pagination: { total, page: 1, per_page: DEFAULT_PER_PAGE, total_pages: 1 },
})

describe('useBooksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  describe('fetchList', () => {
    it('переводит фильтры в параметры спеки, включая per-page через дефис', async () => {
      api.list.mockResolvedValue(listData([]))
      const books = useBooksStore()

      await books.fetchList({ page: 2, perPage: 24, authorId: 5, year: 2023, search: '  Лавр  ' })

      expect(api.list).toHaveBeenCalledWith(
        {
          page: 2,
          'per-page': 24,
          author_id: 5,
          year: 2023,
          search: 'Лавр',
        },
        // Второй аргумент — сигнал отмены: устаревший ответ не должен перебить свежий.
        expect.any(AbortSignal),
      )
    })

    it('не отправляет пустые фильтры', async () => {
      api.list.mockResolvedValue(listData([]))
      const books = useBooksStore()

      await books.fetchList()

      expect(api.list).toHaveBeenCalledWith(
        {
          page: 1,
          'per-page': DEFAULT_PER_PAGE,
          author_id: undefined,
          year: undefined,
          search: undefined,
        },
        expect.any(AbortSignal),
      )
    })

    it('раскладывает ответ по items и pagination', async () => {
      api.list.mockResolvedValue(listData([book(), book({ id: 2, title: 'Лавр' })]))
      const books = useBooksStore()

      await books.fetchList()

      expect(books.items).toHaveLength(2)
      expect(books.pagination.total).toBe(2)
      expect(books.loading).toBe(false)
      expect(books.error).toBeNull()
    })

    it('сохраняет сообщение об ошибке и очищает список', async () => {
      api.list.mockRejectedValue(new ApiError(500, []))
      const books = useBooksStore()

      await books.fetchList()

      expect(books.items).toEqual([])
      expect(books.error).toBe('Ошибка на стороне сервера')
      expect(books.isEmpty).toBe(true)
    })

    it('видит активные фильтры', async () => {
      api.list.mockResolvedValue(listData([]))
      const books = useBooksStore()

      expect(books.hasActiveFilters).toBe(false)
      await books.fetchList({ search: 'Лавр' })
      expect(books.hasActiveFilters).toBe(true)
    })
  })

  describe('update', () => {
    it('без нового файла обложки шлёт PATCH с JSON', async () => {
      api.update.mockResolvedValue(book({ title: 'Новое название' }))
      const books = useBooksStore()

      await books.update(1, { title: 'Новое название', author_ids: [1] }, null)

      expect(api.update).toHaveBeenCalledWith(1, { title: 'Новое название', author_ids: [1] })
      expect(api.replace).not.toHaveBeenCalled()
    })

    it('с новым файлом обложки шлёт PUT с multipart', async () => {
      api.replace.mockResolvedValue(book())
      const books = useBooksStore()
      const cover = new File(['x'], 'cover.jpg', { type: 'image/jpeg' })

      await books.update(1, { title: 'Название', year: 2024, author_ids: [1, 2] }, cover)

      expect(api.replace).toHaveBeenCalledWith(1, {
        title: 'Название',
        year: 2024,
        description: undefined,
        isbn: undefined,
        author_ids: [1, 2],
        cover,
      })
      expect(api.update).not.toHaveBeenCalled()
    })

    it('обновляет книгу в уже загруженном списке', async () => {
      api.list.mockResolvedValue(listData([book(), book({ id: 2, title: 'Лавр' })]))
      api.update.mockResolvedValue(book({ id: 2, title: 'Авиатор' }))
      const books = useBooksStore()
      await books.fetchList()

      await books.update(2, { title: 'Авиатор' }, null)

      expect(books.items[1]?.title).toBe('Авиатор')
    })
  })

  describe('remove', () => {
    it('убирает книгу из списка и уменьшает счётчик', async () => {
      api.list.mockResolvedValue(listData([book(), book({ id: 2 })], 2))
      api.remove.mockResolvedValue(undefined)
      const books = useBooksStore()
      await books.fetchList()

      await books.remove(1)

      expect(books.items.map((item) => item.id)).toEqual([2])
      expect(books.pagination.total).toBe(1)
      expect(books.saving).toBe(false)
    })
  })

  describe('fetchOne', () => {
    it('кладёт книгу в current', async () => {
      api.get.mockResolvedValue(book())
      const books = useBooksStore()

      const result = await books.fetchOne(1)

      expect(result?.id).toBe(1)
      expect(books.current?.title).toBe('Пикник на обочине')
      expect(books.currentError).toBeNull()
    })

    it('запоминает 404 отдельным полем', async () => {
      api.get.mockRejectedValue(new ApiError(404, [{ message: 'Книга не найдена' }]))
      const books = useBooksStore()

      const result = await books.fetchOne(99)

      expect(result).toBeNull()
      expect(books.current).toBeNull()
      expect(books.currentError?.isNotFound).toBe(true)
    })
  })
})
