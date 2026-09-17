import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetDb } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { mountRoute, resetSession } from '@/test/support'

/**
 * Форма новой книги: проверяем подстановку автора из ссылки
 * «Добавить книгу» на странице автора (/books/new?author_id=3).
 */

const server = setupServer(...handlers)

beforeAll(() => {
  window.scrollTo = () => {}
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Маршрут закрыт guard'ом, поэтому входим до навигации.
const mountEditor = (query: Record<string, string> = {}) =>
  mountRoute('/books/new', query, { authorized: true })

describe('BookEditorView', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSession()
    resetDb()
  })

  it('подставляет автора из query-параметра', async () => {
    const wrapper = await mountEditor({ author_id: '3' })

    // Чип выбранного автора показывает ФИО, а не «Автор #3».
    expect(wrapper.text()).toContain('Пелевин Виктор Олегович')
    expect(wrapper.text()).not.toContain('Автор #3')
  })

  it('оставляет поле авторов пустым без query-параметра', async () => {
    const wrapper = await mountEditor()

    expect(wrapper.text()).not.toContain('Пелевин Виктор Олегович')
    expect(wrapper.find('.chip').exists()).toBe(false)
  })

  it('не падает, когда автора из ссылки не существует', async () => {
    const wrapper = await mountEditor({ author_id: '9999' })

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('.chip').exists()).toBe(false)
  })

  it('игнорирует мусор в author_id', async () => {
    const wrapper = await mountEditor({ author_id: 'не-число' })

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('.chip').exists()).toBe(false)
  })
})
