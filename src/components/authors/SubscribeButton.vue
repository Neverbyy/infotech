<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ApiError } from '@/api/http'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PhoneInput from '@/components/ui/PhoneInput.vue'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useToastsStore } from '@/stores/toasts'
import { validatePhone } from '@/utils/validation'

const props = withDefaults(
  defineProps<{
    authorId: number
    fullName: string
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const subscriptions = useSubscriptionsStore()
const toasts = useToastsStore()

const modalOpen = ref(false)
const phone = ref('')
const phoneError = ref('')
const submitting = ref(false)

/* Один computed вместо трёх вызовов в шаблоне: на списке авторов это
   пересчёт Set'а подписок по три раза на каждую карточку. */
const subscribed = computed(() => subscriptions.isSubscribed(props.authorId))
const pending = computed(() => subscriptions.isPending(props.authorId))

function onClick(): void {
  if (subscribed.value) {
    void unsubscribe()
    return
  }
  // Номер уже знаем — подписываем сразу, без лишнего диалога.
  if (subscriptions.hasPhone) {
    void subscribe(subscriptions.phone)
    return
  }
  phone.value = ''
  phoneError.value = ''
  modalOpen.value = true
}

async function subscribe(value: string): Promise<void> {
  submitting.value = true
  try {
    await subscriptions.subscribe(props.authorId, value)
    toasts.success(`Подписка оформлена: ${props.fullName}. Уведомим по SMS`)
    modalOpen.value = false
  } catch (caught) {
    const message = caught instanceof ApiError ? caught.message : 'Не удалось оформить подписку'
    if (caught instanceof ApiError && caught.isValidation) phoneError.value = message
    else toasts.error(message)
  } finally {
    submitting.value = false
  }
}

async function unsubscribe(): Promise<void> {
  try {
    await subscriptions.unsubscribe(props.authorId)
    toasts.info(`Подписка отменена: ${props.fullName}`)
  } catch (caught) {
    toasts.error(caught instanceof ApiError ? caught.message : 'Не удалось отменить подписку')
  }
}

function submitModal(): void {
  const error = validatePhone(phone.value)
  phoneError.value = error ?? ''
  if (!error) void subscribe(phone.value)
}

/** По уходу из поля подсказываем об ошибке, не дожидаясь отправки. */
function validateOnBlur(): void {
  if (phone.value) phoneError.value = validatePhone(phone.value) ?? ''
}

// Пока пользователь правит номер, старая ошибка только мешает.
watch(phone, () => {
  phoneError.value = ''
})
</script>

<template>
  <BaseButton
    :variant="subscribed ? 'subtle' : 'secondary'"
    :size="size"
    :loading="pending"
    :title="subscribed ? 'Вы получаете SMS о новых книгах автора' : 'Получать SMS о новых книгах автора'"
    @click.prevent="onClick"
  >
    <template #icon>
      <svg class="icon" viewBox="0 0 20 20" aria-hidden="true">
        <path
          v-if="subscribed"
          d="M4 10.5l3.5 3.5L16 5.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          v-else
          d="M10 3a4.5 4.5 0 00-4.5 4.5c0 3.5-1.5 4.8-1.5 4.8h12s-1.5-1.3-1.5-4.8A4.5 4.5 0 0010 3zM8.6 15.3a1.6 1.6 0 002.8 0"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>
    {{ subscribed ? 'Вы подписаны' : 'Подписаться' }}
  </BaseButton>

  <BaseModal
    :open="modalOpen"
    title="SMS о новинках автора"
    size="sm"
    :close-on-backdrop="!submitting"
    @close="modalOpen = false"
  >
    <form class="form" novalidate @submit.prevent="submitModal">
      <p class="form__text">
        Пришлём SMS, когда в каталоге появится новая книга автора
        <strong>{{ fullName }}</strong>. Подписка доступна без регистрации.
      </p>

      <PhoneInput
        v-model="phone"
        label="Номер телефона"
        required
        :error="phoneError"
        hint="Номер нужен только для уведомлений о новинках"
        data-autofocus
        @blur="validateOnBlur"
      />

      <button class="visually-hidden" type="submit" tabindex="-1" aria-hidden="true">Подписаться</button>
    </form>

    <template #footer>
      <BaseButton variant="ghost" :disabled="submitting" @click="modalOpen = false">Отмена</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submitModal">Подписаться</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.icon {
  width: 16px;
  height: 16px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form__text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
