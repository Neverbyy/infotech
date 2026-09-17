import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetDb } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { useToastsStore } from '@/stores/toasts'
import { dialogButton, mountRoute, resetSession, settle } from '@/test/support'

/**
 * Характеризующий тест списка авторов: рендер, поиск из URL, права гостя
 * и полный цикл удаления с подтверждением.
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

describe('AuthorsListView', () => {
  it('показывает авторов по алфавиту', async () => {
    const wrapper = await mountRoute('/authors')

    expect(wrapper.text()).toContain('Водолазкин Евгений Германович')
    expect(wrapper.text()).toMatch(new RegExp('Всего \\d+\\u00A0автор'))
  })

  it('применяет поиск из query-параметров', async () => {
    const wrapper = await mountRoute('/authors', { search: 'Стругацкий' })

    expect(wrapper.text()).toContain('Стругацкий Аркадий Натанович')
    expect(wrapper.text()).not.toContain('Пелевин')
  })

  it('показывает пустое состояние, когда ничего не найдено', async () => {
    const wrapper = await mountRoute('/authors', { search: 'несуществующий' })

    expect(wrapper.text()).toContain('Авторы не найдены')
  })

  it('прячет управление каталогом от гостя', async () => {
    const wrapper = await mountRoute('/authors')

    expect(wrapper.text()).not.toContain('Добавить автора')
    expect(wrapper.findAll('.icon-action')).toHaveLength(0)
    // Подписка гостю доступна.
    expect(wrapper.text()).toContain('Подписаться')
  })

  it('показывает управление каталогом пользователю', async () => {
    const wrapper = await mountRoute('/authors', {}, { authorized: true })

    expect(wrapper.text()).toContain('Добавить автора')
    expect(wrapper.findAll('.icon-action').length).toBeGreaterThan(0)
  })

  it('удаляет автора: подтверждение → тост → список без него', async () => {
    const wrapper = await mountRoute('/authors', { search: 'Дяченко Марина' }, { authorized: true })
    const toasts = useToastsStore()
    expect(wrapper.text()).toContain('Дяченко Марина Юрьевна')

    // У Дяченко все книги в соавторстве, поэтому удаление разрешено.
    await wrapper.find('.icon-action--danger').trigger('click')
    await settle()
    expect(document.body.textContent).toContain('Удалить автора?')

    dialogButton('Удалить')?.click()
    await settle()

    expect(toasts.items.some((item) => item.text === 'Автор удалён')).toBe(true)
    expect(wrapper.text()).not.toContain('Дяченко Марина Юрьевна')
  })

  it('показывает ошибку сервера, если удалять нельзя', async () => {
    // У Пелевина все книги сольные — сервер запретит удаление.
    const wrapper = await mountRoute('/authors', { search: 'Пелевин' }, { authorized: true })
    const toasts = useToastsStore()

    await wrapper.find('.icon-action--danger').trigger('click')
    await settle()

    dialogButton('Удалить')?.click()
    await settle()

    expect(toasts.items.some((item) => item.kind === 'error')).toBe(true)
    expect(wrapper.text()).toContain('Пелевин Виктор Олегович')
  })
})
