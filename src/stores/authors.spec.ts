import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authorsApi } from '@/api'
import { ApiError } from '@/api/http'
import type { Author, AuthorShort, ListData } from '@/types/api'
import { DEFAULT_PER_PAGE, useAuthorsStore } from './authors'

vi.mock('@/api', () => ({
  authorsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const api = vi.mocked(authorsApi)

const short = (id: number, full_name = `Автор ${id}`): AuthorShort => ({ id, full_name })

const full = (id: number, overrides: Partial<Author> = {}): Author => ({
  id,
  full_name: `Автор ${id}`,
  books: [{ id: 1, title: 'Лавр', year: 2020 }],
  ...overrides,
})

const listData = (items: AuthorShort[], total = items.length): ListData<AuthorShort> => ({
  items,
  pagination: { total, page: 1, per_page: DEFAULT_PER_PAGE, total_pages: 1 },
})

describe('useAuthorsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  describe('fetchList', () => {
    it('переводит фильтры в параметры спеки, включая per-page через дефис', async () => {
      api.list.mockResolvedValue(listData([]))
      const authors = useAuthorsStore()

      await authors.fetchList({ page: 3, perPage: 50, search: '  Стругацкий  ' })

      expect(api.list).toHaveBeenCalledWith(
        {
          page: 3,
          'per-page': 50,
          search: 'Стругацкий',
        },
        // Второй аргумент — сигнал отмены: устаревший ответ не должен перебить свежий.
        expect.any(AbortSignal),
      )
    })

    it('не отправляет пустой поиск', async () => {
      api.list.mockResolvedValue(listData([]))
      const authors = useAuthorsStore()

      await authors.fetchList()

      expect(api.list).toHaveBeenCalledWith(
        {
          page: 1,
          'per-page': DEFAULT_PER_PAGE,
          search: undefined,
        },
        expect.any(AbortSignal),
      )
    })

    it('раскладывает ответ по items и pagination', async () => {
      api.list.mockResolvedValue(listData([short(1), short(2)]))
      const authors = useAuthorsStore()

      await authors.fetchList()

      expect(authors.items).toHaveLength(2)
      expect(authors.pagination.total).toBe(2)
      expect(authors.loading).toBe(false)
      expect(authors.error).toBeNull()
    })

    it('сохраняет сообщение сервера и очищает список', async () => {
      api.list.mockRejectedValue(new ApiError(500, []))
      const authors = useAuthorsStore()

      await authors.fetchList()

      expect(authors.items).toEqual([])
      expect(authors.error).toBe('Ошибка на стороне сервера')
      expect(authors.isEmpty).toBe(true)
    })

    it('подставляет своё сообщение, когда сервер молчит', async () => {
      // Важно: у книг и авторов запасные тексты РАЗНЫЕ.
      api.list.mockRejectedValue(new TypeError('offline'))
      const authors = useAuthorsStore()

      await authors.fetchList()

      expect(authors.error).toBe('Не удалось загрузить список авторов')
    })
  })

  describe('fetchOne', () => {
    it('кладёт автора вместе с книгами в current', async () => {
      api.get.mockResolvedValue(full(3))
      const authors = useAuthorsStore()

      const result = await authors.fetchOne(3)

      expect(result?.id).toBe(3)
      expect(authors.current?.books).toHaveLength(1)
      expect(authors.currentError).toBeNull()
    })

    it('запоминает 404 отдельным полем', async () => {
      api.get.mockRejectedValue(new ApiError(404, [{ message: 'Автор не найден' }]))
      const authors = useAuthorsStore()

      const result = await authors.fetchOne(99)

      expect(result).toBeNull()
      expect(authors.current).toBeNull()
      expect(authors.currentError?.isNotFound).toBe(true)
    })
  })

  describe('update', () => {
    it('усекает Author до AuthorShort в строке списка', async () => {
      api.list.mockResolvedValue(listData([short(1), short(2)]))
      api.update.mockResolvedValue(full(2, { full_name: 'Новое Имя' }))
      const authors = useAuthorsStore()
      await authors.fetchList()

      await authors.update(2, { full_name: 'Новое Имя' })

      // В списке живёт AuthorShort: книг автора там нет и грузить их незачем.
      expect(authors.items[1]).toEqual({ id: 2, full_name: 'Новое Имя' })
      expect(api.update).toHaveBeenCalledWith(2, { full_name: 'Новое Имя' })
    })

    it('подменяет current, если открыт тот же автор', async () => {
      api.get.mockResolvedValue(full(5))
      api.update.mockResolvedValue(full(5, { full_name: 'Переименованный' }))
      const authors = useAuthorsStore()
      await authors.fetchOne(5)

      await authors.update(5, { full_name: 'Переименованный' })

      expect(authors.current?.full_name).toBe('Переименованный')
    })
  })

  describe('remove', () => {
    it('убирает автора из списка и уменьшает счётчик', async () => {
      api.list.mockResolvedValue(listData([short(1), short(2)], 2))
      api.remove.mockResolvedValue(undefined)
      const authors = useAuthorsStore()
      await authors.fetchList()

      await authors.remove(1)

      expect(authors.items.map((item) => item.id)).toEqual([2])
      expect(authors.pagination.total).toBe(1)
      expect(authors.saving).toBe(false)
    })

    it('обнуляет current, если удалили открытого автора', async () => {
      api.get.mockResolvedValue(full(7))
      api.remove.mockResolvedValue(undefined)
      const authors = useAuthorsStore()
      await authors.fetchOne(7)

      await authors.remove(7)

      expect(authors.current).toBeNull()
    })
  })

  describe('create', () => {
    it('возвращает созданного автора и снимает флаг сохранения', async () => {
      api.create.mockResolvedValue(full(9, { books: [] }))
      const authors = useAuthorsStore()

      const created = await authors.create({ full_name: 'Автор 9' })

      expect(created.id).toBe(9)
      expect(api.create).toHaveBeenCalledWith({ full_name: 'Автор 9' })
      expect(authors.saving).toBe(false)
    })

    it('снимает флаг сохранения и при ошибке', async () => {
      api.create.mockRejectedValue(new ApiError(422, [{ field: 'full_name', message: 'Дубль' }]))
      const authors = useAuthorsStore()

      await expect(authors.create({ full_name: 'Дубль' })).rejects.toThrow('Дубль')
      expect(authors.saving).toBe(false)
    })
  })

  describe('suggest', () => {
    it('ищет по подстроке, не трогая основной список', async () => {
      api.list.mockResolvedValue(listData([short(1)]))
      const authors = useAuthorsStore()

      const found = await authors.suggest('  Пе  ')

      expect(api.list).toHaveBeenCalledWith({ 'per-page': 20, search: 'Пе' }, undefined)
      expect(found).toHaveLength(1)
      // Состояние основного списка остаётся нетронутым.
      expect(authors.items).toEqual([])
    })

    it('на пустой строке берёт справочник, а не ищет заново', async () => {
      api.list.mockResolvedValue(listData([short(1), short(2)]))
      const authors = useAuthorsStore()

      const found = await authors.suggest('')

      expect(api.list).toHaveBeenCalledWith({ 'per-page': 100 })
      expect(found).toHaveLength(2)
    })

    it('не ходит в сеть за справочником дважды', async () => {
      api.list.mockResolvedValue(listData([short(1)]))
      const authors = useAuthorsStore()

      await Promise.all([authors.suggest(''), authors.suggest(''), authors.ensureDirectory()])

      expect(api.list).toHaveBeenCalledTimes(1)
    })

    it('перезапрашивает справочник после правки автора', async () => {
      api.list.mockResolvedValue(listData([short(1)]))
      api.update.mockResolvedValue(full(1, { full_name: 'Другое Имя' }))
      const authors = useAuthorsStore()
      await authors.ensureDirectory()

      await authors.update(1, { full_name: 'Другое Имя' })
      await authors.ensureDirectory()

      // Первый запрос + повторный после инвалидации.
      expect(api.list).toHaveBeenCalledTimes(2)
    })

    it('отдаёт пустой список, если запрос отменили', async () => {
      api.list.mockResolvedValue(listData([short(1)]))
      const authors = useAuthorsStore()
      const controller = new AbortController()
      controller.abort()

      expect(await authors.suggest('Пе', controller.signal)).toEqual([])
    })
  })
})
