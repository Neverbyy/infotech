import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { setAuthToken } from '@/api/http'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

/** Общая обвязка интеграционных тестов страниц. */

/**
 * Гасит сессию между тестами.
 *
 * Токен живёт в модульной переменной http.ts, а не в сторе, поэтому новый
 * createPinia() его не сбрасывает: без этого вызова авторизация протекает
 * из теста в тест.
 */
export function resetSession(): void {
  setAuthToken(null)
}

/**
 * Настоящий вход через мок.
 *
 * Присваивать auth.token напрямую нельзя: токен попадает в заголовки только
 * через setAuthToken(), и запросы такой «сессии» получают 401.
 */
export async function signIn(): Promise<void> {
  await useAuthStore().login({ username: 'user', password: 'password' })
}

export interface MountRouteOptions {
  /** Войти под ролью user до навигации — маршруты CRUD закрыты guard'ом. */
  authorized?: boolean
}

/**
 * Монтирует страницу через RouterView, а не компонентом напрямую:
 * onBeforeRouteLeave внутри вью требует записи маршрута.
 */
export async function mountRoute(
  path: string,
  query: Record<string, string> = {},
  options: MountRouteOptions = {},
): Promise<VueWrapper> {
  const pinia = createPinia()
  setActivePinia(pinia)

  if (options.authorized) await signIn()

  await router.push({ path, query })
  await router.isReady()

  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [pinia, router] } })
  await flushPromises()
  await flushPromises()
  return wrapper
}

/** Ждёт завершения цепочки запрос → состояние → перерисовка. */
export async function settle(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) await flushPromises()
}

/**
 * Ждёт выполнения условия, а не фиксированного числа тактов.
 *
 * Длина цепочки промисов зависит от сценария (логин ещё и навигирует), поэтому
 * подбирать константу на глаз — верный способ получить хрупкий тест.
 */
export async function waitUntil(predicate: () => boolean, attempts = 60): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return
    await flushPromises()
  }
  throw new Error('Условие не выполнилось за отведённое число тактов')
}

/** Кнопка в телепортированном диалоге: модалка живёт в document.body, а не во wrapper. */
export function dialogButton(label: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  )
}
