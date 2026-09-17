<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import BookCard from '@/components/books/BookCard.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import SearchField from '@/components/ui/SearchField.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useQueryFilters } from '@/composables/useQueryFilters'
import { useAuthStore } from '@/stores/auth'
import { useAuthorsStore } from '@/stores/authors'
import { DEFAULT_PER_PAGE, useBooksStore, type BookFilters } from '@/stores/books'
import { pluralWithCount } from '@/utils/format'
import { pickQuery, queryInt } from '@/utils/queryParams'

const books = useBooksStore()
const authors = useAuthorsStore()
const auth = useAuthStore()

const { items, pagination, loading, error, filters, hasActiveFilters } = storeToRefs(books)

const { searchInput, updateQuery, resetQuery } = useQueryFilters<BookFilters>({
  parse: (query) => ({
    page: queryInt(query.page) ?? 1,
    perPage: queryInt(query['per-page']) ?? DEFAULT_PER_PAGE,
    authorId: queryInt(query.author_id),
    year: queryInt(query.year),
    search: pickQuery(query, 'search'),
  }),
  apply: (parsed) => void books.fetchList(parsed),
  search: {},
})

/* ── Справочник авторов для выпадающего фильтра ─────────────────────────── */

// Общий на приложение: тот же список используют подсказки в форме книги.
void authors.ensureDirectory()

const authorSelectOptions = computed(() =>
  authors.directory.map((author) => ({ value: author.id, label: author.full_name })),
)

const authorFilter = computed({
  get: () => filters.value.authorId ?? '',
  set: (value: string | number) => updateQuery({ author_id: value === '' ? null : Number(value) }),
})

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 16 }, (_, index) => {
    const year = current + 1 - index
    return { value: year, label: String(year) }
  })
})

const yearFilter = computed({
  get: () => filters.value.year ?? '',
  set: (value: string | number) => updateQuery({ year: value === '' ? null : Number(value) }),
})

const perPageOptions = [12, 24, 48].map((value) => ({ value, label: `${value} на странице` }))

const perPageFilter = computed({
  get: () => filters.value.perPage,
  set: (value: string | number) => updateQuery({ 'per-page': Number(value) }),
})

const totalLabel = computed(() =>
  pagination.value.total > 0 ? pluralWithCount(pagination.value.total, ['книга', 'книги', 'книг']) : '',
)
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <div class="page-header__title">
        <h1>Книги</h1>
        <p class="page-header__subtitle">
          <template v-if="loading">Загружаем каталог…</template>
          <template v-else-if="totalLabel">В каталоге {{ totalLabel }}</template>
          <template v-else>Каталог пуст</template>
        </p>
      </div>

      <BaseButton v-if="auth.canManage" variant="primary" :to="{ name: 'book-create' }">
        <template #icon><AppIcon name="plus" /></template>
        Добавить книгу
      </BaseButton>
    </header>

    <section class="filters surface" aria-label="Фильтры каталога">
      <SearchField
        v-model="searchInput"
        class="filters__search"
        placeholder="Название, автор или ISBN"
        label="Поиск по каталогу"
      />

      <BaseSelect
        v-model="authorFilter"
        class="filters__select"
        :options="authorSelectOptions"
        placeholder="Все авторы"
        aria-label="Фильтр по автору"
      />

      <BaseSelect
        v-model="yearFilter"
        class="filters__select filters__select--narrow"
        :options="yearOptions"
        placeholder="Все годы"
        aria-label="Фильтр по году"
      />

      <BaseSelect
        v-model="perPageFilter"
        class="filters__select filters__select--narrow"
        :options="perPageOptions"
        aria-label="Книг на странице"
      />

      <BaseButton v-if="hasActiveFilters" variant="ghost" @click="resetQuery">Сбросить</BaseButton>
    </section>

    <StateBlock
      v-if="error"
      kind="error"
      title="Не удалось загрузить книги"
      :description="error"
      class="block"
    >
      <BaseButton variant="secondary" @click="books.fetchList()">Повторить</BaseButton>
    </StateBlock>

    <div v-else-if="loading && items.length === 0" class="grid-books block">
      <div v-for="index in filters.perPage" :key="index" class="skeleton-card">
        <SkeletonBlock height="0" radius="var(--radius-md)" class="skeleton-card__cover" />
        <SkeletonBlock height="0.9rem" width="85%" />
        <SkeletonBlock height="0.75rem" width="60%" />
      </div>
    </div>

    <StateBlock
      v-else-if="items.length === 0"
      title="Книги не найдены"
      :description="
        hasActiveFilters
          ? 'Попробуйте изменить условия поиска или сбросить фильтры.'
          : 'Каталог пока пуст — добавьте первую книгу.'
      "
      class="block"
    >
      <BaseButton v-if="hasActiveFilters" variant="secondary" @click="resetQuery">
        Сбросить фильтры
      </BaseButton>
      <BaseButton v-else-if="auth.canManage" variant="primary" :to="{ name: 'book-create' }">
        Добавить книгу
      </BaseButton>
    </StateBlock>

    <template v-else>
      <div class="grid-books block" :class="{ 'is-loading': loading }">
        <BookCard v-for="book in items" :key="book.id" :book="book" />
      </div>

      <BasePagination
        :pagination="pagination"
        :disabled="loading"
        @change="(page) => updateQuery({ page }, false)"
      />
    </template>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
}

.filters__search {
  flex: 1 1 260px;
}

.filters__select {
  flex: 0 1 220px;
}

.filters__select--narrow {
  flex-basis: 160px;
}

.grid-books.is-loading {
  opacity: 0.55;
  pointer-events: none;
  transition: opacity var(--transition);
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-card__cover {
  aspect-ratio: 2 / 3;
  height: auto !important;
}

@media (max-width: 640px) {
  .filters__select,
  .filters__select--narrow {
    flex: 1 1 100%;
  }
}
</style>
