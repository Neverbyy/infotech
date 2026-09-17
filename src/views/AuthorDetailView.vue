<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'

import AuthorFormModal from '@/components/authors/AuthorFormModal.vue'
import SubscribeButton from '@/components/authors/SubscribeButton.vue'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppBreadcrumbs from '@/components/ui/AppBreadcrumbs.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { useAuthStore } from '@/stores/auth'
import { useAuthorsStore } from '@/stores/authors'
import type { Author } from '@/types/api'
import { pluralWithCount } from '@/utils/format'

const props = defineProps<{ id: string }>()

const router = useRouter()
const authors = useAuthorsStore()
const auth = useAuthStore()

const { current: author, currentLoading: loading, currentError: error } = storeToRefs(authors)

const formOpen = ref(false)

const removal = useConfirmDelete<Author>({
  remove: (item) => authors.remove(item.id),
  success: 'Автор удалён',
  failure: 'Не удалось удалить автора',
  onDone: () => void router.push({ name: 'authors' }),
})

watch(
  () => props.id,
  (id) => {
    void authors.fetchOne(Number(id))
  },
  { immediate: true },
)

const notFound = computed(() => error.value?.isNotFound ?? false)

/** Книги автора, сгруппированные по году выпуска. */
const booksByYear = computed(() => {
  const groups = new Map<number, { id: number; title: string; year: number }[]>()
  for (const book of author.value?.books ?? []) {
    const list = groups.get(book.year) ?? []
    list.push(book)
    groups.set(book.year, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, books]) => ({ year, books: books.sort((a, b) => a.title.localeCompare(b.title, 'ru')) }))
})

</script>

<template>
  <div class="container page">
    <AppBreadcrumbs
      :items="[{ label: 'Авторы', to: { name: 'authors' } }, { label: author?.full_name ?? 'Автор' }]"
    />

    <div v-if="loading" class="stack">
      <SkeletonBlock height="2.2rem" width="45%" />
      <SkeletonBlock height="1rem" width="25%" />
      <SkeletonBlock height="8rem" />
    </div>

    <StateBlock
      v-else-if="notFound"
      title="Автор не найден"
      description="Возможно, его удалили или ссылка устарела."
    >
      <BaseButton variant="primary" :to="{ name: 'authors' }">К списку авторов</BaseButton>
    </StateBlock>

    <StateBlock
      v-else-if="error"
      kind="error"
      title="Не удалось загрузить автора"
      :description="error.message"
    >
      <BaseButton variant="secondary" @click="authors.fetchOne(Number(id))">Повторить</BaseButton>
    </StateBlock>

    <template v-else-if="author">
      <header class="hero surface">
        <AppAvatar :name="author.full_name" size="lg" />

        <div class="hero__text">
          <h1>{{ author.full_name }}</h1>
          <p class="muted text-sm">
            {{
              author.books.length
                ? `В каталоге ${pluralWithCount(author.books.length, ['книга', 'книги', 'книг'])}`
                : 'Книг в каталоге пока нет'
            }}
          </p>
        </div>

        <div class="hero__actions">
          <SubscribeButton :author-id="author.id" :full-name="author.full_name" />
          <div v-if="auth.canManage" class="hero__manage">
            <BaseButton
              variant="primary"
              :to="{ name: 'book-create', query: { author_id: author.id } }"
              title="Автор будет подставлен в форму"
            >
              <template #icon><AppIcon name="plus" /></template>
              Добавить книгу
            </BaseButton>
            <BaseButton variant="secondary" @click="formOpen = true">Редактировать</BaseButton>
            <BaseButton variant="secondary" @click="removal.ask(author)">Удалить</BaseButton>
          </div>
        </div>
      </header>

      <section class="books">
        <div class="books__header">
          <h2>Книги автора</h2>
          <RouterLink
            v-if="author.books.length"
            class="text-sm"
            :to="{ name: 'books', query: { author_id: author.id } }"
          >
            Открыть в каталоге с фильтром →
          </RouterLink>
        </div>

        <StateBlock
          v-if="author.books.length === 0"
          title="Книг пока нет"
          description="Как только в каталоге появится книга этого автора, она отобразится здесь."
        >
          <BaseButton
            v-if="auth.canManage"
            variant="primary"
            :to="{ name: 'book-create', query: { author_id: author.id } }"
          >
            Добавить книгу
          </BaseButton>
        </StateBlock>

        <div v-else class="years">
          <section v-for="group in booksByYear" :key="group.year" class="year">
            <h3 class="year__label">{{ group.year }}</h3>
            <ul class="year__list">
              <li v-for="book in group.books" :key="book.id">
                <RouterLink class="book-row" :to="{ name: 'book-detail', params: { id: book.id } }">
                  <span class="book-row__title">{{ book.title }}</span>
                  <svg class="book-row__arrow" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M7 4l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
      </section>

      <AuthorFormModal :open="formOpen" :author="author" @close="formOpen = false" />

      <ConfirmDialog
        :open="removal.open.value"
        title="Удалить автора?"
        :message="`Автор «${author.full_name}» будет удалён из каталога. Действие необратимо.`"
        confirm-label="Удалить"
        danger
        :loading="removal.deleting.value"
        @confirm="removal.confirm"
        @cancel="removal.cancel"
      />
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}

.hero__text {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hero__text h1 {
  font-size: var(--text-2xl);
}

/* Колонка: подписка сверху, управление каталогом — строкой под ней.
   Обе строки прижаты к правому краю карточки и заканчиваются заподлицо. */
.hero__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-4);
}

.hero__manage {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 720px) {
  .hero__actions {
    width: 100%;
    align-items: stretch;
  }

  .hero__manage {
    justify-content: flex-start;
  }
}


.books {
  margin-top: var(--space-6);
}

.books__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.books__header h2 {
  font-size: var(--text-xl);
}

.years {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.year__label {
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 650;
  letter-spacing: 0.07em;
  color: var(--text-faint);
}

.year__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-2);
}

.book-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition:
    border-color var(--transition),
    transform var(--transition);
}

.book-row:hover {
  border-color: var(--accent);
  transform: translateX(2px);
  text-decoration: none;
}

.book-row__title {
  font-size: var(--text-sm);
  font-weight: 540;
}

.book-row__arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-faint);
}

.book-row:hover .book-row__arrow {
  color: var(--accent-text);
}
</style>
