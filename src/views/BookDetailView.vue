<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'

import BookCover from '@/components/books/BookCover.vue'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppBreadcrumbs from '@/components/ui/AppBreadcrumbs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import type { Book } from '@/types/api'
import { formatIsbn } from '@/utils/format'

const props = defineProps<{ id: string }>()

const router = useRouter()
const books = useBooksStore()
const auth = useAuthStore()

const { current: book, currentLoading: loading, currentError: error } = storeToRefs(books)

const removal = useConfirmDelete<Book>({
  remove: (item) => books.remove(item.id),
  success: 'Книга удалена',
  failure: 'Не удалось удалить книгу',
  onDone: () => void router.push({ name: 'books' }),
})

watch(
  () => props.id,
  (id) => {
    void books.fetchOne(Number(id))
  },
  { immediate: true },
)

const notFound = computed(() => error.value?.isNotFound ?? false)
</script>

<template>
  <div class="container page">
    <AppBreadcrumbs
      :items="[{ label: 'Книги', to: { name: 'books' } }, { label: book?.title ?? 'Книга' }]"
    />

    <div v-if="loading" class="layout">
      <SkeletonBlock class="skeleton-cover" height="0" />
      <div class="stack">
        <SkeletonBlock height="2rem" width="70%" />
        <SkeletonBlock height="1rem" width="40%" />
        <SkeletonBlock height="1rem" width="90%" />
        <SkeletonBlock height="1rem" width="85%" />
        <SkeletonBlock height="1rem" width="60%" />
      </div>
    </div>

    <StateBlock
      v-else-if="notFound"
      title="Книга не найдена"
      description="Возможно, её удалили или ссылка устарела."
    >
      <BaseButton variant="primary" :to="{ name: 'books' }">Вернуться к каталогу</BaseButton>
    </StateBlock>

    <StateBlock
      v-else-if="error"
      kind="error"
      title="Не удалось загрузить книгу"
      :description="error.message"
    >
      <BaseButton variant="secondary" @click="books.fetchOne(Number(id))">Повторить</BaseButton>
    </StateBlock>

    <article v-else-if="book" class="layout">
      <div class="layout__cover">
        <BookCover :src="book.cover_url" :title="book.title" size="detail" />
      </div>

      <div class="details">
        <header class="details__header">
          <h1>{{ book.title }}</h1>
          <p class="details__meta">
            <span class="pill">{{ book.year }}</span>
            <span v-if="book.isbn" class="mono faint">ISBN {{ formatIsbn(book.isbn) }}</span>
          </p>
        </header>

        <section v-if="book.authors.length" class="details__section">
          <h2 class="details__label">Авторы</h2>
          <ul class="authors">
            <li v-for="author in book.authors" :key="author.id">
              <RouterLink class="author-chip" :to="{ name: 'author-detail', params: { id: author.id } }">
                <AppAvatar :name="author.full_name" size="xs" />
                {{ author.full_name }}
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="details__section">
          <h2 class="details__label">Описание</h2>
          <p v-if="book.description" class="details__description">{{ book.description }}</p>
          <p v-else class="faint text-sm">Описание не заполнено</p>
        </section>

        <div v-if="auth.canManage" class="details__actions">
          <BaseButton variant="primary" :to="{ name: 'book-edit', params: { id: book.id } }">
            Редактировать
          </BaseButton>
          <BaseButton variant="secondary" @click="removal.ask(book)">Удалить</BaseButton>
        </div>
        <p v-else class="details__hint text-sm muted">
          Редактирование доступно авторизованным пользователям.
          <RouterLink :to="{ name: 'login', query: { redirect: `/books/${book.id}` } }">Войти</RouterLink>
        </p>
      </div>
    </article>

    <ConfirmDialog
      :open="removal.open.value"
      title="Удалить книгу?"
      :message="`Книга «${book?.title ?? ''}» будет удалена из каталога. Действие необратимо.`"
      confirm-label="Удалить"
      danger
      :loading="removal.deleting.value"
      @confirm="removal.confirm"
      @cancel="removal.cancel"
    />
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;
}

.layout__cover {
  position: sticky;
  top: calc(var(--header-height) + var(--space-4));
}

.skeleton-cover {
  aspect-ratio: 2 / 3;
  height: auto !important;
  border-radius: var(--radius-lg);
}

.details {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.details__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.details__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.pill {
  padding: 3px var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: var(--radius-full);
}

.details__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.details__label {
  font-size: var(--text-xs);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-faint);
}

.authors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.author-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
  font-size: var(--text-sm);
  font-weight: 540;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  transition:
    border-color var(--transition),
    color var(--transition);
}

.author-chip:hover {
  color: var(--accent-text);
  border-color: var(--accent);
  text-decoration: none;
}

.details__description {
  max-width: 70ch;
  color: var(--text-muted);
  white-space: pre-line;
}

.details__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.details__hint {
  padding-top: var(--space-2);
}

@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }

  .layout__cover {
    position: static;
    max-width: 220px;
  }
}
</style>
