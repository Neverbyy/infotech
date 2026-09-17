<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useQueryFilters } from '@/composables/useQueryFilters'
import { useReportsStore } from '@/stores/reports'
import { pluralWithCount } from '@/utils/format'
import { queryIntInRange } from '@/utils/queryParams'

const route = useRoute()
const reports = useReportsStore()

const { items, loading, error, loadedYear, maxBooks } = storeToRefs(reports)

const currentYear = new Date().getFullYear()
const MIN_YEAR = 1450
const MAX_YEAR = currentYear + 1

const selectedYear = ref(currentYear)

const { updateQuery } = useQueryFilters<number>({
  parse: (query) => queryIntInRange(query.year, MIN_YEAR, MAX_YEAR, currentYear),
  apply: (year) => {
    selectedYear.value = year
    void reports.fetchTopAuthors(year)
  },
})

/**
 * Выбор года. Если в URL того же года ещё нет, навигация сама запустит загрузку
 * через вотчер; если он уже там (например, при первом заходе без параметра) —
 * перезапрашиваем вручную, иначе повторное нажатие ничего не сделает.
 */
function applyYear(value: number): void {
  if (String(value) === String(route.query.year ?? currentYear)) {
    void reports.fetchTopAuthors(value)
    return
  }
  updateQuery({ year: value }, false)
}

/** Выпадающий список: выбрать год */
const yearModel = computed<string | number>({
  get: () => selectedYear.value,
  set: (value) => {
    const year = Number(value)
    selectedYear.value = year
    applyYear(year)
  },
})


const FIRST_LISTED_YEAR = 2010

const yearOptions = computed(() => {
  const years: number[] = []
  for (let year = MAX_YEAR; year >= FIRST_LISTED_YEAR; year -= 1) years.push(year)

  // Год из ссылки может лежать вне списка — иначе селект окажется пустым.
  if (!years.includes(selectedYear.value)) {
    years.push(selectedYear.value)
    years.sort((a, b) => b - a)
  }

  return years.map((year) => ({ value: year, label: String(year) }))
})

/** Быстрые ссылки на последние годы. */
const quickYears = computed(() => Array.from({ length: 5 }, (_, index) => currentYear - index))

function barWidth(count: number): string {
  if (maxBooks.value === 0) return '0%'
  return `${Math.max(6, Math.round((count / maxBooks.value) * 100))}%`
}
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <div class="page-header__title">
        <h1>ТОП-10 авторов</h1>
        <p class="page-header__subtitle">
          Авторы, выпустившие больше всего книг за выбранный год. Отчёт доступен всем пользователям.
        </p>
      </div>
    </header>

    <section class="controls surface" aria-label="Параметры отчёта">
      <BaseSelect
        v-model="yearModel"
        class="year-select"
        label="Год выпуска"
        :options="yearOptions"
        :disabled="loading"
      />

      <div class="quick">
        <span class="quick__label text-xs faint">Быстрый выбор:</span>
        <button
          v-for="year in quickYears"
          :key="year"
          class="quick__item"
          :class="{ 'is-active': selectedYear === year }"
          type="button"
          @click="yearModel = year"
        >
          {{ year }}
        </button>
      </div>
    </section>

    <StateBlock v-if="error" kind="error" title="Отчёт не построен" :description="error" class="block">
      <BaseButton variant="secondary" @click="reports.fetchTopAuthors()">Повторить</BaseButton>
    </StateBlock>

    <div v-else-if="loading" class="report surface block">
      <div v-for="index in 6" :key="index" class="row row--skeleton">
        <SkeletonBlock width="28px" height="28px" circle />
        <SkeletonBlock height="0.9rem" width="40%" />
        <SkeletonBlock height="0.7rem" width="15%" />
      </div>
    </div>

    <StateBlock
      v-else-if="items.length === 0"
      :title="`За ${loadedYear ?? selectedYear} год книг нет`"
      description="Выберите другой год — в демо-данных больше всего книг за 2021–2024."
      class="block"
    />

    <div v-else class="report surface block">
      <header class="report__header">
        <h2 class="report__title">Итоги {{ loadedYear }} года</h2>
        <p class="text-sm muted">
          {{ pluralWithCount(items.length, ['автор', 'автора', 'авторов']) }} в рейтинге
        </p>
      </header>

      <ol class="rows">
        <li v-for="item in items" :key="item.author_id" class="row" :class="{ 'row--top': item.rank <= 3 }">
          <span class="rank" :data-rank="item.rank">{{ item.rank }}</span>

          <RouterLink class="row__name" :to="{ name: 'author-detail', params: { id: item.author_id } }">
            {{ item.full_name }}
          </RouterLink>

          <div class="row__bar" aria-hidden="true">
            <span class="row__bar-fill" :style="{ width: barWidth(item.books_count) }" />
          </div>

          <RouterLink
            class="row__count"
            :to="{ name: 'books', query: { author_id: item.author_id, year: loadedYear ?? undefined } }"
            :title="`Показать книги автора за ${loadedYear} год`"
          >
            {{ pluralWithCount(item.books_count, ['книга', 'книги', 'книг']) }}
          </RouterLink>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
}

.year-select {
  flex: 0 0 auto;
  width: 100px;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.quick__item {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 560;
  color: var(--text-muted);
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition:
    color var(--transition),
    background var(--transition),
    border-color var(--transition);
}

.quick__item:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.quick__item.is-active {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: transparent;
}

.report {
  overflow: hidden;
}

.report__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg-inset);
}

.report__title {
  font-size: var(--text-lg);
}

.rows {
  list-style: none;
  padding: 0;
  margin: 0;
}

.row {
  display: grid;
  grid-template-columns: 34px minmax(140px, 1.4fr) minmax(80px, 2fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.row:last-child {
  border-bottom: 0;
}

.row--skeleton {
  grid-template-columns: 34px 1fr auto;
}

.rank {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-subtle);
  border-radius: 50%;
}

.row--top .rank {
  color: #fff;
  background: var(--accent);
}

.rank[data-rank='1'] {
  background: #d99b1c;
}

.rank[data-rank='2'] {
  background: #97a0b0;
}

.rank[data-rank='3'] {
  background: #b0764a;
}

.row__name {
  font-size: var(--text-sm);
  font-weight: 560;
  color: var(--text);
}

.row__name:hover {
  color: var(--accent-text);
}

.row__bar {
  height: 8px;
  background: var(--bg-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.row__bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #22d3ee));
  border-radius: var(--radius-full);
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.row__count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.row__count:hover {
  color: var(--accent-text);
}

@media (max-width: 680px) {
  .row {
    grid-template-columns: 30px 1fr auto;
  }

  .row__bar {
    grid-column: 2 / -1;
    grid-row: 2;
  }
}
</style>
