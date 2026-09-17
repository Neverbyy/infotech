import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetDb } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { useAuthStore } from '@/stores/auth'
import { mountRoute, resetSession, settle, waitUntil } from '@/test/support'

/**
 * Форма входа: клиентская валидация, ошибка сервера и успешный сценарий.
 * Проверяет тот же путь обработки ошибок, что используют остальные формы.
 */

const server = setupServer(...handlers)

beforeAll(() => {
  window.scrollTo = () => {}
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  localStorage.clear()
  resetSession()
  resetDb()
})

async function submit(wrapper: Awaited<ReturnType<typeof mountRoute>>, login: string, password: string) {
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue(login)
  await inputs[1]!.setValue(password)
  await wrapper.find('form').trigger('submit')
  await settle()
}

/** Вход плюс навигация — ждём по факту, а не по числу тактов. */
async function submitAndWaitSignedIn(
  wrapper: Awaited<ReturnType<typeof mountRoute>>,
  login: string,
  password: string,
) {
  await submit(wrapper, login, password)
  await waitUntil(() => useAuthStore().isAuthenticated)
}

describe('LoginView', () => {
  it('требует заполнить оба поля', async () => {
    const wrapper = await mountRoute('/login')

    await wrapper.find('form').trigger('submit')
    await settle()

    expect(wrapper.text()).toContain('Укажите логин')
    expect(wrapper.text()).toContain('Укажите пароль')
  })

  it('показывает сообщение сервера при неверном пароле', async () => {
    const wrapper = await mountRoute('/login')

    await submit(wrapper, 'user', 'неверный')

    expect(wrapper.text()).toContain('Неверный логин или пароль')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('пускает в каталог с верными данными', async () => {
    const wrapper = await mountRoute('/login')

    await submitAndWaitSignedIn(wrapper, 'user', 'password')

    expect(useAuthStore().username).toBe('user')
  })

  it('очищает ошибку сервера при повторной попытке', async () => {
    const wrapper = await mountRoute('/login')
    await submit(wrapper, 'user', 'неверный')
    expect(wrapper.text()).toContain('Неверный логин или пароль')

    await submitAndWaitSignedIn(wrapper, 'user', 'password')

    expect(wrapper.text()).not.toContain('Неверный логин или пароль')
  })
})
