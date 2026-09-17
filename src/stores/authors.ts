import { ref } from 'vue'
import { defineStore } from 'pinia'

import { authorsApi } from '@/api'
import type { Author, AuthorInput, AuthorListParams, AuthorShort } from '@/types/api'
import { createListResource, type BaseFilters } from './createListResource'

export const DEFAULT_PER_PAGE = 20

/** Размер выдачи подсказок в форме книги. */
const SUGGEST_SIZE = 20

/** Сколько авторов тянем в справочник для фильтра и подсказок. */
const DIRECTORY_SIZE = 100

export type AuthorFilters = BaseFilters

export const defaultFilters = (): AuthorFilters => ({
  page: 1,
  perPage: DEFAULT_PER_PAGE,
  search: '',
})

export const useAuthorsStore = defineStore('authors', () => {
  const resource = createListResource<AuthorShort, Author, AuthorFilters, AuthorListParams>({
    defaults: defaultFilters,
    toParams: (value) => ({
      page: value.page,
      'per-page': value.perPage,
      search: value.search.trim() || undefined,
    }),
    fetchPage: (params, signal) => authorsApi.list(params, signal),
    fetchDetail: (id, signal) => authorsApi.get(id, signal),
    deleteOne: (id) => authorsApi.remove(id),
    /* В списке живёт AuthorShort: книги автора там не показываются. */
    toListItem: (author) => ({ id: author.id, full_name: author.full_name }),
    listErrorMessage: 'Не удалось загрузить список авторов',
  })

  /* ── Справочник авторов ──────────────────────────────────────────────────
     Один и тот же список нужен фильтру каталога и подсказкам в форме книги.
     Раньше это были два независимых запроса, причём фильтр перезапрашивал сто
     авторов при каждом монтировании страницы. Теперь — один запрос на сессию
     с промисом-хранителем: параллельные вызовы склеиваются. */

  const directory = ref<AuthorShort[]>([])
  let directoryRequest: Promise<AuthorShort[]> | null = null

  function ensureDirectory(): Promise<AuthorShort[]> {
    directoryRequest ??= authorsApi
      .list({ 'per-page': DIRECTORY_SIZE })
      .then((data) => (directory.value = data.items ?? []))
      .catch(() => {
        // Ошибку не кэшируем: следующий заход должен попробовать снова.
        directoryRequest = null
        return []
      })
    return directoryRequest
  }

  /** Справочник устарел: автора добавили, переименовали или удалили. */
  function invalidateDirectory(): void {
    directory.value = []
    directoryRequest = null
  }

  function create(payload: AuthorInput): Promise<Author> {
    return resource.withSaving(async () => {
      const author = await authorsApi.create(payload)
      invalidateDirectory()
      return author
    })
  }

  function update(id: number, payload: AuthorInput): Promise<Author> {
    return resource.withSaving(async () => {
      const author = await authorsApi.update(id, payload)
      resource.applySaved(id, author)
      invalidateDirectory()
      return author
    })
  }

  async function remove(id: number): Promise<void> {
    await resource.api.remove(id)
    invalidateDirectory()
  }

  /** Поиск для выпадающего списка в форме книги — состояние основного списка не трогает. */
  async function suggest(search: string, signal?: AbortSignal): Promise<AuthorShort[]> {
    const query = search.trim()
    // Пустой запрос — это «покажи всех»: берём из справочника, не ходим в сеть.
    if (!query) return (await ensureDirectory()).slice(0, SUGGEST_SIZE)

    const data = await authorsApi.list({ 'per-page': SUGGEST_SIZE, search: query }, signal)
    if (signal?.aborted) return []
    return data.items ?? []
  }

  return { ...resource.api, directory, ensureDirectory, invalidateDirectory, suggest, create, update, remove }
})
