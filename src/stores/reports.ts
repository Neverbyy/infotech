import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { reportsApi } from '@/api'
import type { TopAuthor } from '@/types/api'
import { errorMessage } from '@/utils/errors'

export const useReportsStore = defineStore('reports', () => {
  const year = ref<number>(new Date().getFullYear())
  const items = ref<TopAuthor[]>([])
  const loadedYear = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isEmpty = computed(() => !loading.value && loadedYear.value !== null && items.value.length === 0)
  /** Максимум для масштабирования полосок в таблице отчёта. */
  const maxBooks = computed(() => items.value.reduce((max, item) => Math.max(max, item.books_count), 0))

  async function fetchTopAuthors(nextYear?: number): Promise<void> {
    if (typeof nextYear === 'number') year.value = nextYear

    loading.value = true
    error.value = null
    try {
      const data = await reportsApi.topAuthors(year.value)
      items.value = data.items ?? []
      loadedYear.value = data.year ?? year.value
    } catch (caught) {
      items.value = []
      loadedYear.value = null
      error.value = errorMessage(caught, 'Не удалось построить отчёт')
    } finally {
      loading.value = false
    }
  }

  return { year, items, loadedYear, loading, error, isEmpty, maxBooks, fetchTopAuthors }
})
