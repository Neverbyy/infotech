import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi } from '@/api'
import { ApiError } from '@/api/http'
import { useAuthStore } from './auth'

vi.mock('@/api', () => ({
  authApi: { login: vi.fn() },
}))

const login = vi.mocked(authApi.login)

const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString()

const loginResponse = (expiresAt = inHours(8)) => ({
  token: 'token-123',
  expires_at: expiresAt,
  user: { id: 1, username: 'user', role: 'user' },
})

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    login.mockReset()
  })

  it('стартует гостем', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.canManage).toBe(false)
    expect(auth.role).toBe('guest')
  })

  it('сохраняет токен и пользователя после входа', async () => {
    login.mockResolvedValue(loginResponse())
    const auth = useAuthStore()

    await auth.login({ username: 'user', password: 'password' })

    expect(login).toHaveBeenCalledWith({ username: 'user', password: 'password' })
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.username).toBe('user')
    expect(auth.role).toBe('user')
    expect(auth.canManage).toBe(true)
  })

  it('кладёт сессию в localStorage и поднимает её через restore()', async () => {
    login.mockResolvedValue(loginResponse())
    await useAuthStore().login({ username: 'user', password: 'password' })

    setActivePinia(createPinia())
    const restored = useAuthStore()
    expect(restored.isAuthenticated).toBe(false)

    restored.restore()
    expect(restored.isAuthenticated).toBe(true)
    expect(restored.username).toBe('user')
  })

  it('не восстанавливает протухшую сессию', async () => {
    login.mockResolvedValue(loginResponse(inHours(-1)))
    await useAuthStore().login({ username: 'user', password: 'password' })

    setActivePinia(createPinia())
    const restored = useAuthStore()
    restored.restore()

    expect(restored.isAuthenticated).toBe(false)
    expect(localStorage.getItem('catalog.auth')).toBeNull()
  })

  it('сбрасывает состояние и хранилище при выходе', async () => {
    login.mockResolvedValue(loginResponse())
    const auth = useAuthStore()
    await auth.login({ username: 'user', password: 'password' })

    auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(localStorage.getItem('catalog.auth')).toBeNull()
  })

  it('пробрасывает ошибку 401 и снимает флаг загрузки', async () => {
    login.mockRejectedValue(new ApiError(401, [{ message: 'Неверный логин или пароль' }]))
    const auth = useAuthStore()

    await expect(auth.login({ username: 'user', password: 'wrong' })).rejects.toThrow(
      'Неверный логин или пароль',
    )
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.loading).toBe(false)
  })
})
