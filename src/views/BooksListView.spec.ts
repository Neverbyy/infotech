import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetDb } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { mountRoute, resetSession } from '@/test/support'

/**
 * Интеграционный тест: реальные компоненты, сторы, роутер и API-клиент,
 * а вместо бэкенда — те же MSW-хендлеры
 */

const server = setupServer(...handlers)

beforeAll(() => {
  // scrollBehavior роутера дёргает window.scrollTo, которого в jsdom нет.
  window.scrollTo = () => {}
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mountView = (query: Record<string, string> = {}) => mountRoute('/books', query)

describe('BooksListView', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSession()
    resetDb()
  })

  it('показывает книги из каталога, начиная с самых свежих', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('article')).toHaveLength(12)
    // Список отсортирован по году по убыванию, поэтому на первой странице — 2024 год.
    expect(wrapper.text()).toContain('Вегетация')
    expect(wrapper.text()).toContain('Иванов Алексей Викторович')
  })

  it('уводит книги 2021 года на вторую страницу', async () => {
    const first = await mountView()
    expect(first.text()).not.toContain('Пикник на обочине')

    const second = await mountView({ page: '2' })
    expect(second.text()).toContain('Пикник на обочине')
  })

  it('выводит счётчик книг в подзаголовке', async () => {
    const wrapper = await mountView()
    // Число и слово разделены неразрывным пробелом — см. pluralWithCount.
    expect(wrapper.text()).toMatch(new RegExp('В каталоге \\d+\\u00A0книг'))
  })

  it('применяет фильтр по автору из query-параметров', async () => {
    const wrapper = await mountView({ author_id: '3', 'per-page': '50' })

    const titles = wrapper.findAll('article h3').map((node) => node.text())
    expect(titles.length).toBeGreaterThan(0)
    expect(titles).toContain('Generation «П»')
    expect(titles).not.toContain('Лавр')
  })

  it('применяет поиск из query-параметров', async () => {
    const wrapper = await mountView({ search: 'Лавр' })

    const titles = wrapper.findAll('article h3').map((node) => node.text())
    expect(titles).toEqual(['Лавр'])
  })

  it('показывает пустое состояние, когда ничего не найдено', async () => {
    const wrapper = await mountView({ search: 'несуществующая книга' })

    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).toContain('Книги не найдены')
    expect(wrapper.text()).toContain('Сбросить фильтры')
  })

  it('прячет кнопку добавления от гостя и показывает её пользователю', async () => {
    const guestView = await mountView()
    expect(guestView.text()).not.toContain('Добавить книгу')

    const userView = await mountRoute('/books', {}, { authorized: true })
    expect(userView.text()).toContain('Добавить книгу')
  })

  it('наполняет фильтр авторов справочником из API', async () => {
    const wrapper = await mountView()

    const options = wrapper.findAll('select')[0]?.findAll('option').map((node) => node.text()) ?? []
    expect(options[0]).toBe('Все авторы')
    expect(options).toContain('Пелевин Виктор Олегович')
  })
})
