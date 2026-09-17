<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useFormErrors } from '@/composables/useFormErrors'
import { useAuthorsStore } from '@/stores/authors'
import { useToastsStore } from '@/stores/toasts'
import type { Author, AuthorShort } from '@/types/api'
import { hasErrors, validateAuthorForm } from '@/utils/validation'

const props = defineProps<{
  open: boolean
  /** Передан — режим редактирования, null — создание. */
  author?: AuthorShort | Author | null
  /** Предзаполнение имени при быстром создании из формы книги. */
  initialName?: string
}>()

const emit = defineEmits<{ close: []; saved: [author: Author] }>()

const authorsStore = useAuthorsStore()
const toasts = useToastsStore()

const fullName = ref('')
const { errors, generalErrors, submitting, clear, run } = useFormErrors('Не удалось сохранить автора')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    fullName.value = props.author?.full_name ?? props.initialName ?? ''
    clear()
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  errors.value = validateAuthorForm(fullName.value)
  generalErrors.value = []
  if (hasErrors(errors.value)) return

  const payload = { full_name: fullName.value.trim() }
  const saved = await run(() =>
    props.author ? authorsStore.update(props.author.id, payload) : authorsStore.create(payload),
  )
  if (!saved) return

  // Тост тут показываем сами: ошибку модалка выводит только внутри формы.
  toasts.success(props.author ? 'Автор обновлён' : 'Автор добавлен')
  emit('saved', saved)
  emit('close')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="author ? 'Редактирование автора' : 'Новый автор'"
    size="sm"
    :close-on-backdrop="!submitting"
    @close="emit('close')"
  >
    <form class="form" novalidate @submit.prevent="submit">
      <div v-if="generalErrors.length" class="alert" role="alert">
        <p v-for="message in generalErrors" :key="message">{{ message }}</p>
      </div>

      <BaseInput
        v-model="fullName"
        label="ФИО автора"
        placeholder="Иванов Иван Иванович"
        required
        :error="errors.full_name"
        data-autofocus
      />

      <!-- Скрытая кнопка, чтобы Enter в поле отправлял форму -->
      <button class="visually-hidden" type="submit" tabindex="-1" aria-hidden="true">Сохранить</button>
    </form>

    <template #footer>
      <BaseButton variant="ghost" :disabled="submitting" @click="emit('close')">Отмена</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">
        {{ author ? 'Сохранить' : 'Добавить' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.alert {
  padding: var(--space-3);
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-soft);
  border-radius: var(--radius-md);
}
</style>
