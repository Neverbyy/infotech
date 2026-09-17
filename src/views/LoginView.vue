<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useFormErrors } from '@/composables/useFormErrors'
import { useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'
import { hasErrors, validateLoginForm } from '@/utils/validation'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toasts = useToastsStore()

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const { errors, generalErrors, submitting, run } = useFormErrors('Не удалось выполнить вход')

async function submit(): Promise<void> {
  errors.value = validateLoginForm(username.value, password.value)
  generalErrors.value = []
  if (hasErrors(errors.value)) return

  const entered = await run(async () => {
    await auth.login({ username: username.value.trim(), password: password.value })
    return true
  })
  if (!entered) return

  toasts.success(`Добро пожаловать, ${auth.username}`)

  // Возвращаем туда, откуда пришли, но только по внутреннему пути.
  const redirect = route.query.redirect
  const target = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/books'
  void router.replace(target)
}

function fillDemo(): void {
  username.value = 'user'
  password.value = 'password'
}
</script>

<template>
  <div class="container page login">
    <div class="card surface">
      <header class="card__header">
        <span class="card__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M7 10V7.5a5 5 0 0110 0V10M5.5 10h13a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0118.5 20h-13A1.5 1.5 0 014 18.5v-7A1.5 1.5 0 015.5 10z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <h1>Вход в каталог</h1>
        <p class="muted text-sm">
          Просмотр каталога доступен без входа. Авторизация нужна для добавления, редактирования и
          удаления книг и авторов.
        </p>
      </header>

      <form class="form" novalidate @submit.prevent="submit">
        <p v-if="generalErrors.length" class="alert" role="alert">{{ generalErrors[0] }}</p>

        <BaseInput
          v-model="username"
          label="Логин"
          placeholder="user"
          autocomplete="username"
          required
          :error="errors.username"
          :disabled="submitting"
        />

        <BaseInput
          v-model="password"
          label="Пароль"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          autocomplete="current-password"
          required
          :error="errors.password"
          :disabled="submitting"
        >
          <template #suffix>
            <button
              class="icon-action reveal"
              type="button"
              :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M3 10s2.8-4.5 7-4.5 7 4.5 7 4.5-2.8 4.5-7 4.5S3 10 3 10zM4 4l12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              <svg v-else viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 10s2.8-4.5 7-4.5 7 4.5 7 4.5-2.8 4.5-7 4.5S3 10 3 10z" fill="none" stroke="currentColor" stroke-width="1.5" />
                <circle cx="10" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </button>
          </template>
        </BaseInput>

        <BaseButton type="submit" variant="primary" size="lg" block :loading="submitting">Войти</BaseButton>
      </form>

      <aside v-if="useMock" class="demo">
        <p class="demo__title">Демо-доступ</p>
        <p class="demo__text">
          Логин <code class="mono">user</code>, пароль <code class="mono">password</code>
        </p>
        <button class="demo__fill" type="button" @click="fillDemo">Подставить</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: 100%;
  max-width: 420px;
  padding: var(--space-6);
  margin-top: var(--space-5);
}

.card__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.card__mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: var(--space-2);
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: var(--radius-md);
}

.card__mark svg {
  width: 24px;
  height: 24px;
}

.card__header h1 {
  font-size: var(--text-2xl);
}

.reveal {
  --icon-action-size: 30px;
}

.demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-inset);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
}

.demo__title {
  width: 100%;
  font-size: var(--text-xs);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.demo__text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.demo__fill {
  margin-left: auto;
  padding: 0;
  font-size: var(--text-xs);
  font-weight: 560;
  color: var(--accent-text);
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
}
</style>
