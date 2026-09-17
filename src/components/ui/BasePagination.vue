<script setup lang="ts">
import { computed } from 'vue'

import type { Pagination } from '@/types/api'

const props = defineProps<{
  pagination: Pagination
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [page: number] }>()

const totalPages = computed(() => Math.max(1, props.pagination.total_pages || 1))
const page = computed(() => Math.min(Math.max(1, props.pagination.page || 1), totalPages.value))

/** 1 … 4 5 6 … 20 — окно вокруг текущей страницы плюс края. */
const pages = computed<(number | 'gap')[]>(() => {
  const total = totalPages.value
  const currentPage = page.value
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const result: (number | 'gap')[] = [1]
  const from = Math.max(2, currentPage - 1)
  const to = Math.min(total - 1, currentPage + 1)

  if (from > 2) result.push('gap')
  for (let value = from; value <= to; value += 1) result.push(value)
  if (to < total - 1) result.push('gap')
  result.push(total)

  return result
})

const rangeLabel = computed(() => {
  const { total, per_page: perPage } = props.pagination
  if (!total) return 'Ничего не найдено'
  const first = (page.value - 1) * (perPage || 1) + 1
  const last = Math.min(total, page.value * (perPage || 1))
  return `${first}–${last} из ${total}`
})

function go(next: number): void {
  if (props.disabled) return
  const target = Math.min(Math.max(1, next), totalPages.value)
  if (target !== page.value) emit('change', target)
}
</script>

<template>
  <nav v-if="totalPages > 1 || pagination.total > 0" class="pagination" aria-label="Постраничная навигация">
    <p class="pagination__range">{{ rangeLabel }}</p>

    <ul v-if="totalPages > 1" class="pagination__list">
      <li>
        <button
          class="pagination__btn"
          type="button"
          :disabled="disabled || page === 1"
          aria-label="Предыдущая страница"
          @click="go(page - 1)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M12 5l-5 5 5 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </li>

      <li v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === 'gap'" class="pagination__gap">…</span>
        <button
          v-else
          class="pagination__btn"
          :class="{ 'is-active': item === page }"
          type="button"
          :disabled="disabled"
          :aria-current="item === page ? 'page' : undefined"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </li>

      <li>
        <button
          class="pagination__btn"
          type="button"
          :disabled="disabled || page === totalPages"
          aria-label="Следующая страница"
          @click="go(page + 1)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M8 5l5 5-5 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* Сетка 1fr | auto | 1fr: кнопки страниц стоят ровно по центру блока
   независимо от длины подписи «1–12 из 26» слева. */
.pagination {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.pagination__range {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.pagination__list {
  grid-column: 2;
  justify-self: center;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  list-style: none;
  padding: 0;
  margin: 0;
}

.pagination__btn {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding-inline: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 560;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--transition),
    color var(--transition),
    border-color var(--transition);
}

.pagination__btn svg {
  width: 18px;
  height: 18px;
}

.pagination__btn:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--text);
}

.pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination__btn.is-active {
  color: var(--text-inverse);
  background: var(--accent);
  border-color: var(--accent);
}

.pagination__gap {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 36px;
  color: var(--text-faint);
}

/* На узких экранах три колонки не помещаются — складываем в столбик по центру. */
@media (max-width: 560px) {
  .pagination {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: var(--space-2);
  }

  .pagination__list {
    grid-column: 1;
    order: -1;
  }
}
</style>
