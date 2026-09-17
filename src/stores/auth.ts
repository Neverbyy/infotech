import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { authApi } from '@/api'
import { setAuthToken, setUnauthorizedHandler } from '@/api/http'
import type { LoginRequest, User } from '@/types/api'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

const STORAGE_KEY = 'catalog.auth'

interface PersistedAuth {
  token: string
  expiresAt: string | null
  user: User | null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const expiresAt = ref<string | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => token.value !== null)
  const username = computed(() => user.value?.username ?? '')
  const role = computed(() => user.value?.role ?? 'guest')
  /** Роли user разрешён CRUD; гость видит только чтение и подписки. */
  const canManage = computed(() => isAuthenticated.value)

  function isExpired(value: string | null): boolean {
    if (!value) return false
    const time = new Date(value).getTime()
    return Number.isFinite(time) && time <= Date.now()
  }

  function apply(next: PersistedAuth | null): void {
    token.value = next?.token ?? null
    expiresAt.value = next?.expiresAt ?? null
    user.value = next?.user ?? null
    setAuthToken(token.value)
    if (next) writeStorage(STORAGE_KEY, next)
    else removeStorage(STORAGE_KEY)
  }

  /** Поднимает сессию из localStorage при старте приложения. */
  function restore(): void {
    const saved = readStorage<PersistedAuth | null>(STORAGE_KEY, null)
    if (!saved?.token || isExpired(saved.expiresAt)) {
      apply(null)
      return
    }
    apply(saved)
  }

  async function login(credentials: LoginRequest): Promise<void> {
    loading.value = true
    try {
      const data = await authApi.login(credentials)
      apply({ token: data.token, expiresAt: data.expires_at ?? null, user: data.user ?? null })
    } finally {
      loading.value = false
    }
  }

  function logout(): void {
    apply(null)
  }

  // Любой 401 от бэкенда означает, что токен протух, — гасим сессию.
  setUnauthorizedHandler(() => {
    if (token.value) apply(null)
  })

  return {
    token,
    expiresAt,
    user,
    loading,
    isAuthenticated,
    username,
    role,
    canManage,
    restore,
    login,
    logout,
  }
})
