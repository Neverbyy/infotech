<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { authorsApi } from '@/api'
import { ApiError } from '@/api/http'
import AuthorPicker from '@/components/books/AuthorPicker.vue'
import CoverUpload from '@/components/books/CoverUpload.vue'
import AppBreadcrumbs from '@/components/ui/AppBreadcrumbs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useFormErrors } from '@/composables/useFormErrors'
import { useBooksStore } from '@/stores/books'
import { useToastsStore } from '@/stores/toasts'
import type { AuthorShort } from '@/types/api'
import { queryInt } from '@/utils/queryParams'
import { hasErrors, validateBookForm } from '@/utils/validation'

const props = defineProps<{ id?: string }>()

const route = useRoute()
const router = useRouter()
const books = useBooksStore()
const toasts = useToastsStore()

const isEdit = computed(() => !!props.id)
const bookId = computed(() => (props.id ? Number(props.id) : null))

const form = reactive({
  title: '',
  year: String(new Date().getFullYear()),
  description: '',
  isbn: '',
  author_ids: [] as number[],
  cover: null as File | null,
})

const preselectedAuthors = ref<AuthorShort[]>([])
const existingCover = ref<string | undefined>(undefined)

const { errors, generalErrors, submitting, run } = useFormErrors('Не удалось сохранить книгу')
const loading = ref(false)
const loadError = ref<ApiError | null>(null)
const dirty = ref(false)
const saved = ref(false)

/* ── Загрузка книги в режиме редактирования ─────────────────────────────── */

/** Заполнение формы данными с сервера не должно помечать её как изменённую. */
let suppressDirty = false

watch(
  bookId,
  async (id) => {
    if (id === null) return
    loading.value = true
    loadError.value = null
    suppressDirty = true
    try {
      const book = await books.fetchOne(id)
      if (!book) {
        loadError.value = books.currentError
        return
      }
      form.title = book.title
      form.year = String(book.year)
      form.description = book.description ?? ''
      form.isbn = book.isbn ?? ''
      form.author_ids = book.authors.map((author) => author.id)
      preselectedAuthors.value = book.authors
      existingCover.value = book.cover_url
    } finally {
      loading.value = false
      await nextTick()
      dirty.value = false
      suppressDirty = false
    }
  },
  { immediate: true },
)

watch(
  () => ({ ...form }),
  () => {
    if (!suppressDirty) dirty.value = true
  },
  { deep: true },
)

/* ── Автор из ссылки «Добавить книгу» на странице автора ────────────────── */

/** ?author_id=5 — подставляем этого автора в новую книгу. */
const presetAuthorId = computed(() => queryInt(route.query.author_id))

onMounted(async () => {
  const id = presetAuthorId.value
  if (isEdit.value || id === null) return

  suppressDirty = true
  try {
    // Тянем автора ради ФИО: иначе в поле будет «Автор #5» вместо имени.
    const author = await authorsApi.get(id)
    form.author_ids = [author.id]
    preselectedAuthors.value = [{ id: author.id, full_name: author.full_name }]
  } catch {
    // Автора удалили или ссылку поправили руками — просто оставляем поле пустым.
  } finally {
    await nextTick()
    dirty.value = false
    suppressDirty = false
  }
})

/* ── Отправка ───────────────────────────────────────────────────────────── */

async function submit(): Promise<void> {
  errors.value = validateBookForm({
    title: form.title,
    year: form.year,
    description: form.description,
    isbn: form.isbn,
    author_ids: form.author_ids,
    cover: form.cover,
    hasExistingCover: isEdit.value && !!existingCover.value,
  })
  generalErrors.value = []
  if (hasErrors(errors.value)) {
    toasts.error('Проверьте заполнение формы')
    return
  }

  const payload = {
    title: form.title.trim(),
    year: Number(form.year),
    description: form.description.trim() || undefined,
    isbn: form.isbn.trim() || undefined,
    author_ids: form.author_ids,
  }

  const book = await run(() =>
    isEdit.value && bookId.value !== null
      ? // Без нового файла уходит PATCH (JSON), с файлом — PUT (multipart).
        books.update(bookId.value, payload, form.cover)
      : books.create({ ...payload, cover: form.cover! }),
  )

  if (!book) {
    // Текст уже разложен по полям и в общий блок — остаётся показать тост.
    toasts.error(generalErrors.value[0] ?? 'Сервер отклонил данные формы')
    return
  }

  saved.value = true
  toasts.success(isEdit.value ? 'Книга обновлена' : 'Книга добавлена в каталог')
  void router.push({ name: 'book-detail', params: { id: book.id } })
}

onBeforeRouteLeave(() => {
  if (!dirty.value || saved.value) return true
  return window.confirm('Изменения не сохранены. Покинуть страницу?')
})

const backLink = computed<RouteLocationRaw>(() =>
  bookId.value !== null ? { name: 'book-detail', params: { id: bookId.value } } : { name: 'books' },
)
</script>

<template>
  <div class="container page">
    <AppBreadcrumbs
      :items="[
        { label: 'Книги', to: { name: 'books' } },
        { label: isEdit ? 'Редактирование' : 'Новая книга' },
      ]"
    />

    <StateBlock
      v-if="loadError"
      :kind="loadError.isNotFound ? 'empty' : 'error'"
      :title="loadError.isNotFound ? 'Книга не найдена' : 'Не удалось загрузить книгу'"
      :description="loadError.isNotFound ? 'Возможно, её удалили.' : loadError.message"
    >
      <BaseButton variant="primary" :to="{ name: 'books' }">К каталогу</BaseButton>
    </StateBlock>

    <div v-else-if="loading" class="editor surface">
      <SkeletonBlock height="1.6rem" width="45%" />
      <SkeletonBlock height="2.5rem" />
      <SkeletonBlock height="2.5rem" width="60%" />
      <SkeletonBlock height="7rem" />
    </div>

    <form v-else class="editor surface" novalidate @submit.prevent="submit">
      <header class="editor__header">
        <h1>{{ isEdit ? 'Редактирование книги' : 'Новая книга' }}</h1>
        <p class="muted text-sm">
          Поля со звёздочкой обязательны. Обложка
          {{ isEdit ? 'заменяется только при выборе нового файла' : 'загружается вместе с книгой' }}.
        </p>
      </header>

      <div v-if="generalErrors.length" class="alert" role="alert">
        <p v-for="message in generalErrors" :key="message">{{ message }}</p>
      </div>

      <div class="editor__grid">
        <BaseInput
          v-model="form.title"
          class="editor__wide"
          label="Название"
          placeholder="Например, Пикник на обочине"
          required
          :error="errors.title"
          :disabled="submitting"
        />

        <BaseInput
          v-model="form.year"
          label="Год выпуска"
          type="number"
          inputmode="numeric"
          placeholder="2024"
          required
          :error="errors.year"
          :disabled="submitting"
        />

        <BaseInput
          v-model="form.isbn"
          label="ISBN"
          placeholder="978-5-17-114732-7"
          hint="Необязательно. Поддерживаются ISBN-10 и ISBN-13"
          :error="errors.isbn"
          :disabled="submitting"
        />

        <AuthorPicker
          v-model="form.author_ids"
          class="editor__wide"
          :preselected="preselectedAuthors"
          :error="errors.author_ids"
          :disabled="submitting"
        />

        <BaseTextarea
          v-model="form.description"
          class="editor__wide"
          label="Описание"
          placeholder="О чём книга"
          :rows="6"
          :maxlength="5000"
          :error="errors.description"
          :disabled="submitting"
        />

        <CoverUpload
          v-model="form.cover"
          class="editor__wide"
          :existing-url="existingCover"
          :error="errors.cover"
          :hint="isEdit ? 'Оставьте пустым, чтобы сохранить текущую обложку' : undefined"
          :disabled="submitting"
        />
      </div>

      <footer class="editor__footer">
        <BaseButton variant="ghost" :to="backLink" :disabled="submitting">Отмена</BaseButton>
        <BaseButton type="submit" variant="primary" :loading="submitting">
          {{ isEdit ? 'Сохранить изменения' : 'Добавить книгу' }}
        </BaseButton>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 820px;
  padding: var(--space-6);
}

.editor__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.editor__wide {
  grid-column: 1 / -1;
}

.editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .editor {
    padding: var(--space-4);
  }

  .editor__grid {
    grid-template-columns: 1fr;
  }

  .editor__footer {
    flex-direction: column-reverse;
  }
}
</style>
