import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import { pickQuery } from '@/utils/queryParams'

/**
 * Фильтры списка, живущие в query-параметрах URL.
 *
 * URL — единственный источник правды: и первая загрузка, и кнопка «назад»
 * в браузере проходят через один и тот же путь, а ссылкой на отфильтрованный
 * список можно поделиться.
 */

export type QueryPatch = Record<string, string | number | null>

export interface QueryFiltersOptions<TFilters> {
  /** Чистая функция query → фильтры: тестируется без роутера. */
  parse: (query: LocationQuery) => TFilters
  /** Что делать с разобранными фильтрами — обычно fetchList стора. */
  apply: (filters: TFilters) => void
  /** Поле поиска с задержкой. Не передано — поля на странице нет. */
  search?: { key?: string; delay?: number }
}

export function useQueryFilters<TFilters>(options: QueryFiltersOptions<TFilters>) {
  const route = useRoute()
  const router = useRouter()

  const searchKey = options.search?.key ?? 'search'
  const delay = options.search?.delay ?? 350

  const searchInput = ref(pickQuery(route.query, searchKey))

  /* deep не нужен: vue-router на каждую навигацию кладёт в currentRoute новый
     объект, поэтому геттер меняет идентичность и без глубокого обхода. */
  watch(
    () => route.query,
    (query) => {
      if (options.search) {
        const value = pickQuery(query, searchKey)
        if (value !== searchInput.value) searchInput.value = value
      }
      options.apply(options.parse(query))
    },
    { immediate: true },
  )

  /** Патч query. По умолчанию сбрасывает страницу: новый фильтр — новая выдача. */
  function updateQuery(patch: QueryPatch, resetPage = true): void {
    const merged: Record<string, unknown> = { ...route.query, ...patch }
    if (resetPage) delete merged.page

    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(merged)) {
      if (value === null || value === undefined || value === '') continue
      next[key] = String(value)
    }
    void router.push({ query: next })
  }

  /** Полный сброс: пустой query, а не набор null-ов. */
  function resetQuery(): void {
    searchInput.value = ''
    void router.push({ query: {} })
  }

  /* Поиск с задержкой: не дёргаем API на каждое нажатие. Вотчер регистрируется
     после основного — иначе immediate-прогон сразу запустил бы дебаунс. */
  if (options.search) {
    let timer: ReturnType<typeof setTimeout> | null = null

    watch(searchInput, (value) => {
      if (timer) clearTimeout(timer)
      if (value === pickQuery(route.query, searchKey)) return
      timer = setTimeout(() => updateQuery({ [searchKey]: value.trim() || null }), delay)
    })

    onBeforeUnmount(() => {
      if (timer) clearTimeout(timer)
    })
  }

  return { searchInput, updateQuery, resetQuery }
}
