import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { ApiError } from '@/api/http'
import type { ListData, Pagination } from '@/types/api'
import { errorMessage, isAbortError } from '@/utils/errors'

/**
 * Общая механика списочного ресурса спеки: страница + фильтры + карточка.
 *
 * Книги и авторы устроены одинаково — список с пагинацией и поиском, деталь по id,
 * удаление. Различаются только вызовами API и формой фильтров, поэтому всё общее
 * живёт здесь, а специфика (PATCH/PUT у книг, подсказки у авторов) остаётся
 * в самих сторах.
 */

const EMPTY_PAGINATION: Pagination = { total: 0, page: 1, per_page: 20, total_pages: 0 }

/** Минимум, который есть у любого списка: страница, размер, строка поиска. */
export interface BaseFilters {
  page: number
  perPage: number
  search: string
}

interface Identified {
  id: number
}

export interface ListResourceOptions<
  TItem extends Identified,
  TDetail extends Identified,
  TFilters extends BaseFilters,
  TParams,
> {
  defaults: () => TFilters
  /** Фильтры интерфейса → параметры спеки (per-page через дефис и т.п.). */
  toParams: (filters: TFilters) => TParams
  fetchPage: (params: TParams, signal: AbortSignal) => Promise<ListData<TItem>>
  fetchDetail: (id: number, signal: AbortSignal) => Promise<TDetail>
  deleteOne: (id: number) => Promise<void>
  /**
   * Деталь → строка списка. У книги это тождество, у автора — усечение
   * Author → AuthorShort: списку книги автора не нужны.
   */
  toListItem: (detail: TDetail) => TItem
  /** Сообщение, когда сервер своего не прислал: обрыв сети, 5xx без тела. */
  listErrorMessage: string
}

/** Публичная часть: уходит в стор спредом, поэтому контракт сторов не меняется. */
export interface ListResourceApi<TItem, TDetail, TFilters> {
  items: Ref<TItem[]>
  pagination: Ref<Pagination>
  filters: Ref<TFilters>
  loading: Ref<boolean>
  error: Ref<string | null>
  current: Ref<TDetail | null>
  currentLoading: Ref<boolean>
  currentError: Ref<ApiError | null>
  saving: Ref<boolean>
  isEmpty: ComputedRef<boolean>
  fetchList: (next?: Partial<TFilters>) => Promise<void>
  fetchOne: (id: number) => Promise<TDetail | null>
  remove: (id: number) => Promise<void>
}

export interface ListResource<TItem, TDetail, TFilters> {
  api: ListResourceApi<TItem, TDetail, TFilters>
  /** Обёртка для create/update конкретного стора: держит флаг saving. */
  withSaving: <T>(run: () => Promise<T>) => Promise<T>
  /** Сохранённую сущность кладём и в current, и в соответствующую строку списка. */
  applySaved: (id: number, detail: TDetail) => void
}

export function createListResource<
  TItem extends Identified,
  TDetail extends Identified,
  TFilters extends BaseFilters,
  TParams,
>(options: ListResourceOptions<TItem, TDetail, TFilters, TParams>): ListResource<TItem, TDetail, TFilters> {
  /* Приведения обязательны: для дженерика ref<TItem[]>([]) выводится как
     Ref<UnwrapRef<TItem>[]>, и strict TS перестаёт принимать Book[].
     На рантайм не влияет — ref остаётся глубоко реактивным. */
  const items = ref([]) as Ref<TItem[]>
  const pagination = ref<Pagination>({ ...EMPTY_PAGINATION })
  const filters = ref(options.defaults()) as Ref<TFilters>
  const loading = ref(false)
  const error = ref<string | null>(null)

  const current = ref(null) as Ref<TDetail | null>
  const currentLoading = ref(false)
  const currentError = ref<ApiError | null>(null)
  const saving = ref(false)

  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  /* Отменяем предыдущий запрос: быстрый ввод в поиске и быстрые переходы между
     карточками не должны ронять порядок ответов. */
  let listController: AbortController | null = null
  let detailController: AbortController | null = null

  async function fetchList(next?: Partial<TFilters>): Promise<void> {
    if (next) filters.value = { ...filters.value, ...next }

    listController?.abort()
    const controller = new AbortController()
    listController = controller

    loading.value = true
    error.value = null
    try {
      const data = await options.fetchPage(options.toParams(filters.value), controller.signal)
      if (controller.signal.aborted) return
      items.value = data.items ?? []
      pagination.value = data.pagination ?? { ...EMPTY_PAGINATION, page: filters.value.page }
    } catch (caught) {
      if (isAbortError(caught) || controller.signal.aborted) return
      items.value = []
      pagination.value = { ...EMPTY_PAGINATION }
      error.value = errorMessage(caught, options.listErrorMessage)
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }

  async function fetchOne(id: number): Promise<TDetail | null> {
    detailController?.abort()
    const controller = new AbortController()
    detailController = controller

    currentLoading.value = true
    currentError.value = null
    current.value = null
    try {
      const detail = await options.fetchDetail(id, controller.signal)
      if (controller.signal.aborted) return null
      current.value = detail
      return detail
    } catch (caught) {
      if (isAbortError(caught) || controller.signal.aborted) return null
      currentError.value = caught instanceof ApiError ? caught : new ApiError(0, [])
      return null
    } finally {
      if (!controller.signal.aborted) currentLoading.value = false
    }
  }

  async function withSaving<T>(run: () => Promise<T>): Promise<T> {
    saving.value = true
    try {
      return await run()
    } finally {
      saving.value = false
    }
  }

  function applySaved(id: number, detail: TDetail): void {
    if (current.value?.id === id) current.value = detail
    const index = items.value.findIndex((item) => item.id === id)
    if (index !== -1) items.value[index] = options.toListItem(detail)
  }

  async function remove(id: number): Promise<void> {
    await withSaving(async () => {
      await options.deleteOne(id)
      items.value = items.value.filter((item) => item.id !== id)
      pagination.value = { ...pagination.value, total: Math.max(0, pagination.value.total - 1) }
      if (current.value?.id === id) current.value = null
    })
  }

  return {
    api: {
      items,
      pagination,
      filters,
      loading,
      error,
      current,
      currentLoading,
      currentError,
      saving,
      isEmpty,
      fetchList,
      fetchOne,
      remove,
    },
    withSaving,
    applySaved,
  }
}
