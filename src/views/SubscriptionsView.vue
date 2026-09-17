<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'

import { ApiError } from '@/api/http'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PhoneInput from '@/components/ui/PhoneInput.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useToastsStore } from '@/stores/toasts'
import { formatDateTime, formatPhone } from '@/utils/format'
import { validatePhone } from '@/utils/validation'

const subscriptions = useSubscriptionsStore()
const toasts = useToastsStore()

const { items, notifications, loading, error, phone, hasPhone } = storeToRefs(subscriptions)

const phoneInput = ref(phone.value)
const phoneError = ref('')

watch(phoneInput, () => {
  phoneError.value = ''
})

function validateOnBlur(): void {
  if (phoneInput.value) phoneError.value = validatePhone(phoneInput.value) ?? ''
}

async function loadSubscriptions(): Promise<void> {
  const invalid = validatePhone(phoneInput.value)
  phoneError.value = invalid ?? ''
  if (invalid) return
  await subscriptions.loadFor(phoneInput.value)
}

async function unsubscribe(authorId: number, fullName: string): Promise<void> {
  try {
    await subscriptions.unsubscribe(authorId)
    toasts.info(`Подписка отменена: ${fullName}`)
  } catch (caught) {
    toasts.error(caught instanceof ApiError ? caught.message : 'Не удалось отменить подписку')
  }
}

function forget(): void {
  subscriptions.forget()
  phoneInput.value = ''
  phoneError.value = ''
}

// Номер мог подставиться после восстановления подписок при старте.
watch(phone, (value) => {
  if (value && !phoneInput.value) phoneInput.value = value
})

// Открыли страницу — показываем актуальное, не заставляя нажимать кнопку.
onMounted(() => {
  if (hasPhone.value) void subscriptions.loadFor(phone.value)
})
</script>

<template>
  <div class="container page">
    <header class="page-header">
      <div class="page-header__title">
        <h1>Мои подписки</h1>
        <p class="page-header__subtitle">
          SMS о новых книгах авторов. Подписка доступна гостям — достаточно номера телефона.
        </p>
      </div>

      <BaseButton v-if="hasPhone" variant="ghost" @click="forget">Сменить номер</BaseButton>
    </header>

    <section class="phone-box surface">
      <form class="phone-form" novalidate @submit.prevent="loadSubscriptions">
        <PhoneInput
          v-model="phoneInput"
          class="phone-form__input"
          label="Номер телефона"
          :error="phoneError"
          :hint="hasPhone ? `Текущий номер: ${formatPhone(phone)}` : 'Номер, на который оформлены подписки'"
          @blur="validateOnBlur"
        />
        <BaseButton type="submit" variant="primary" :loading="loading">Показать подписки</BaseButton>
      </form>
    </section>

    <StateBlock v-if="error" kind="error" title="Не удалось загрузить подписки" :description="error" class="block" />

    <StateBlock
      v-else-if="!hasPhone"
      title="Номер не указан"
      description="Введите номер выше или подпишитесь на автора на его странице — номер запомнится автоматически."
      class="block"
    >
      <BaseButton variant="primary" :to="{ name: 'authors' }">К списку авторов</BaseButton>
    </StateBlock>

    <template v-else>
      <StateBlock
        v-if="!loading && items.length === 0"
        title="Подписок пока нет"
        :description="`На номер ${formatPhone(phone)} не оформлено ни одной подписки.`"
        class="block"
      >
        <BaseButton variant="primary" :to="{ name: 'authors' }">Выбрать автора</BaseButton>
      </StateBlock>

      <ul v-else class="list block">
        <li v-for="item in items" :key="item.author_id" class="item surface">
          <AppAvatar :name="item.full_name || '?'" size="sm" />

          <div class="item__text">
            <RouterLink class="item__name" :to="{ name: 'author-detail', params: { id: item.author_id } }">
              {{ item.full_name || `Автор #${item.author_id}` }}
            </RouterLink>
            <span class="item__date text-xs faint">Подписка от {{ formatDateTime(item.subscribed_at) }}</span>
          </div>

          <BaseButton
            variant="ghost"
            size="sm"
            :loading="subscriptions.isPending(item.author_id)"
            @click="unsubscribe(item.author_id, item.full_name)"
          >
            Отписаться
          </BaseButton>
        </li>
      </ul>

      <section class="log block">
        <header class="log__header">
          <h2>Отправленные SMS</h2>
          <div class="log__meta">
            <span v-if="subscriptions.polling" class="live">
              <span class="live__dot" aria-hidden="true" />
              Обновляется автоматически
            </span>
          </div>
        </header>

        <StateBlock
          v-if="notifications.length === 0"
          title="Уведомлений ещё не было"
          description="Как только в каталоге появится новая книга автора из ваших подписок, здесь появится запись об отправленной SMS."
        />

        <ul v-else class="sms-list">
          <li v-for="sms in notifications" :key="sms.id" class="sms surface">
            <span class="sms__status" :class="`sms__status--${sms.status}`">
              {{ sms.status === 'sent' ? 'Отправлено' : 'Ошибка' }}
            </span>

            <div class="sms__body">
              <p class="sms__text">{{ sms.text }}</p>
              <p class="sms__meta text-xs faint">
                {{ formatDateTime(sms.sent_at) }}
                ·
                <RouterLink v-if="sms.book_id !== null" :to="{ name: 'book-detail', params: { id: sms.book_id } }">
                  {{ sms.book_title }}
                </RouterLink>
                <!-- Книгу удалили: запись об отправленном SMS остаётся, ссылки уже нет. -->
                <span v-else class="sms__removed" title="Книга удалена из каталога">
                  <s>{{ sms.book_title }}</s> — удалена из каталога
                </span>
              </p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.phone-box {
  padding: var(--space-4);
}

.phone-form {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.phone-form__input {
  flex: 1;
  max-width: 420px;
}

.phone-form :deep(.btn) {
  margin-top: 26px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.item__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.item__name {
  font-size: var(--text-sm);
  font-weight: 560;
  color: var(--text);
}

.item__name:hover {
  color: var(--accent-text);
}

.log__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.log__header h2 {
  font-size: var(--text-xl);
}

.log__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.live {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 560;
  color: var(--success-text);
}

.live__dot {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

.sms-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.sms {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.sms__status {
  flex-shrink: 0;
  padding: 2px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-full);
}

.sms__status--sent {
  color: var(--success-text);
  background: var(--success-soft);
}

.sms__status--failed {
  color: var(--danger-text);
  background: var(--danger-soft);
}

.sms__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.sms__text {
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.sms__removed s {
  text-decoration-color: var(--border-strong);
}

@media (max-width: 600px) {
  .phone-form {
    flex-direction: column;
    align-items: stretch;
  }

  .phone-form :deep(.btn) {
    margin-top: 0;
  }
}
</style>
