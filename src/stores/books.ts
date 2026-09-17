import { computed } from 'vue'
import { defineStore } from 'pinia'

import { booksApi } from '@/api'
import type { Book, BookFormPayload, BookInput, BookListParams } from '@/types/api'
import { createListResource, type BaseFilters } from './createListResource'

export const DEFAULT_PER_PAGE = 12

export interface BookFilters extends BaseFilters {
  authorId: number | null
  year: number | null
}

export const defaultFilters = (): BookFilters => ({
  page: 1,
  perPage: DEFAULT_PER_PAGE,
  authorId: null,
  year: null,
  search: '',
})

export const useBooksStore = defineStore('books', () => {
  const resource = createListResource<Book, Book, BookFilters, BookListParams>({
    defaults: defaultFilters,
    toParams: (value) => ({
      page: value.page,
      'per-page': value.perPage,
      author_id: value.authorId ?? undefined,
      year: value.year ?? undefined,
      search: value.search.trim() || undefined,
    }),
    fetchPage: (params, signal) => booksApi.list(params, signal),
    fetchDetail: (id, signal) => booksApi.get(id, signal),
    deleteOne: (id) => booksApi.remove(id),
    toListItem: (book) => book,
    listErrorMessage: 'Не удалось загрузить список книг',
  })

  const { filters } = resource.api

  const hasActiveFilters = computed(
    () => filters.value.search !== '' || filters.value.authorId !== null || filters.value.year !== null,
  )

  function create(payload: BookFormPayload): Promise<Book> {
    return resource.withSaving(() => booksApi.create(payload))
  }

  /**
   * Обновление книги. В спеке обложка обязательна для PUT (multipart), поэтому
   * при редактировании без нового файла уходит PATCH с JSON — так пользователю
   * не приходится перезагружать картинку ради правки описания.
   */
  function update(id: number, payload: BookInput, cover: File | null): Promise<Book> {
    return resource.withSaving(async () => {
      const book = cover
        ? await booksApi.replace(id, {
            title: payload.title ?? '',
            year: payload.year ?? 0,
            description: payload.description,
            isbn: payload.isbn,
            author_ids: payload.author_ids ?? [],
            cover,
          })
        : await booksApi.update(id, payload)

      resource.applySaved(id, book)
      return book
    })
  }

  return { ...resource.api, hasActiveFilters, create, update }
})
