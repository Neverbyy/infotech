<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'

import AuthorFormModal from '@/components/authors/AuthorFormModal.vue'
import SubscribeButton from '@/components/authors/SubscribeButton.vue'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SearchField from '@/components/ui/SearchField.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { useQueryFilters } from '@/composables/useQueryFilters'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_PER_PAGE, useAuthorsStore, type AuthorFilters } from '@/stores/authors'
import type { AuthorShort } from '@/types/api'
import { pluralWithCount } from '@/utils/format'
import { pickQuery, queryInt } from '@/utils/queryParams'

const authors = useAuthorsStore()
const auth = useAuthStore()

const { items, pagination, loading, error, filters } = storeToRefs(authors)

const { searchInput, updateQuery } = useQueryFilters<AuthorFilters>({
  parse: (query) => ({
    page: queryInt(query.page) ?? 1,
    perPage: queryInt(query['per-page']) ?? DEFAULT_PER_PAGE,
    search: pickQuery(query, 'search'),
  }),
  apply: (parsed) => void authors.fetchList(parsed),
  search: {},
})

/* ── Создание, редактирование, удаление ─────────────────────────────────── */

const formOpen = ref(false)
const editing = ref<AuthorShort | null>(null)

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

function openEdit(author: AuthorShort): void {
  editing.value = author
  formOpen.value = true
}

function onSaved(): void {
  void authors.fetchList()
}

const removal = useConfirmDelete<AuthorShort>({
  remove: (author) => authors.remove(author.id),
  success: 'Автор удалён',
  failure: 'Не удалось удалить автора',
  // Перезапрашиваем страницу: иначе в ней останется 19 карточек из 20
  // и «съедет» пагинация.
  onDone: () => void authors.fetchList(),
})

const totalLabel = computed(() =>
  pagination.value.total > 0 ? pluralWithCount(pagination.value.total, ['автор', 'автора', 'авторов']) : '',
)
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <div class="page-header__title">
        <h1>Авторы</h1>
        <p class="page-header__subtitle">
          <template v-if="loading">Загружаем список…</template>
          <template v-else-if="totalLabel">Всего {{ totalLabel }}</template>
          <template v-else>Список пуст</template>
        </p>
      </div>

      <BaseButton v-if="auth.canManage" variant="primary" @click="openCreate">
        <template #icon><AppIcon name="plus" /></template>
        Добавить автора
      </BaseButton>
    </header>

    <section class="filters surface" aria-label="Поиск авторов">
      <SearchField
        v-model="searchInput"
        class="filters__search"
        placeholder="Поиск по ФИО"
        label="Поиск по ФИО автора"
      />
    </section>

    <StateBlock v-if="error" kind="error" title="Не удалось загрузить авторов" :description="error" class="block">
      <BaseButton variant="secondary" @click="authors.fetchList()">Повторить</BaseButton>
    </StateBlock>

    <div v-else-if="loading && items.length === 0" class="grid-authors block">
      <div v-for="index in 8" :key="index" class="author-card surface">
        <div class="author-card__main">
          <SkeletonBlock width="40px" height="40px" circle />
          <div class="stack" style="flex: 1; gap: var(--space-2)">
            <SkeletonBlock height="0.9rem" width="75%" />
            <SkeletonBlock height="0.9rem" width="45%" />
          </div>
        </div>
        <div class="author-card__actions">
          <SkeletonBlock height="32px" radius="var(--radius-md)" />
        </div>
      </div>
    </div>

    <StateBlock
      v-else-if="items.length === 0"
      title="Авторы не найдены"
      :description="filters.search ? 'Попробуйте изменить запрос.' : 'Добавьте первого автора в каталог.'"
      class="block"
    >
      <BaseButton v-if="auth.canManage && !filters.search" variant="primary" @click="openCreate">
        Добавить автора
      </BaseButton>
    </StateBlock>

    <template v-else>
      <ul class="grid-authors block" :class="{ 'is-loading': loading }">
        <li v-for="author in items" :key="author.id" class="author-card surface">
          <RouterLink class="author-card__main" :to="{ name: 'author-detail', params: { id: author.id } }">
            <AppAvatar :name="author.full_name" />
            <span class="author-card__name">{{ author.full_name }}</span>
          </RouterLink>

          <div class="author-card__actions">
            <div class="author-card__subscribe">
              <SubscribeButton :author-id="author.id" :full-name="author.full_name" size="sm" />
            </div>

            <template v-if="auth.canManage">
              <button class="icon-action" type="button" title="Редактировать" @click="openEdit(author)">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="icon-action icon-action--danger"
                type="button"
                title="Удалить"
                @click="removal.ask(author)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6M8.5 9v4M11.5 9v4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </template>
          </div>
        </li>
      </ul>

      <BasePagination
        :pagination="pagination"
        :disabled="loading"
        @change="(page) => updateQuery({ page }, false)"
      />
    </template>

    <AuthorFormModal
      :open="formOpen"
      :author="editing"
      @close="formOpen = false"
      @saved="onSaved"
    />

    <ConfirmDialog
      :open="removal.open.value"
      title="Удалить автора?"
      :message="`Автор «${removal.target.value?.full_name ?? ''}» будет удалён. Книги, где он единственный автор, удалить не получится.`"
      confirm-label="Удалить"
      danger
      :loading="removal.deleting.value"
      @confirm="removal.confirm"
      @cancel="removal.cancel"
    />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
}

.filters__search {
  flex: 1;
}

.grid-authors {
  list-style: none;
  padding: 0;
  margin-top: var(--space-5);
}

.grid-authors.is-loading {
  opacity: 0.55;
  pointer-events: none;
}

/* Колонка, а не строка: ФИО переносится на несколько строк и не должно
   толкать кнопки. Действия прижаты к низу, поэтому в ряду сетки они
   выравниваются между карточками разной высоты. */
.author-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}

.author-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.author-card__main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
  color: var(--text);
}

.author-card__main:hover {
  text-decoration: none;
}

.author-card__main:hover .author-card__name {
  color: var(--accent-text);
}

.author-card__name {
  font-size: var(--text-sm);
  font-weight: 560;
  line-height: 1.4;
  min-width: 0;
  overflow-wrap: anywhere;
  transition: color var(--transition);
}

.author-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: auto;
}

.author-card__subscribe {
  flex: 1;
  min-width: 0;
}

/* Кнопка подписки занимает всю свободную ширину строки действий —
   и у гостя, и рядом с иконками редактирования у пользователя. */
.author-card__subscribe :deep(.btn) {
  width: 100%;
}
</style>
