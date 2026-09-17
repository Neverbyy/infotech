import { describe, expect, it } from 'vitest'

import { pickQuery, queryInt, queryIntInRange, queryString } from './queryParams'

describe('queryString', () => {
  it('возвращает строку как есть', () => {
    expect(queryString('Лавр')).toBe('Лавр')
  })

  it('из повторяющегося параметра берёт первое значение', () => {
    expect(queryString(['первое', 'второе'])).toBe('первое')
  })

  it.each([[undefined], [null], [[]]])('на %s отдаёт пустую строку', (input) => {
    expect(queryString(input as never)).toBe('')
  })
})

describe('queryInt', () => {
  it.each([
    ['5', 5],
    ['1', 1],
  ])('разбирает «%s»', (input, expected) => {
    expect(queryInt(input)).toBe(expected)
  })

  it.each([['0'], ['-3'], ['2.5'], ['abc'], [''], [undefined]])('отвергает «%s»', (input) => {
    expect(queryInt(input as never)).toBeNull()
  })

  it('работает с повторяющимся параметром', () => {
    expect(queryInt(['3', '9'])).toBe(3)
  })
})

describe('queryIntInRange', () => {
  it('пропускает значение внутри границ', () => {
    expect(queryIntInRange('2023', 2010, 2027, 2026)).toBe(2023)
  })

  it.each([['2009'], ['2028'], ['мусор'], [undefined]])(
    'подставляет запасное значение для «%s»',
    (input) => {
      expect(queryIntInRange(input as never, 2010, 2027, 2026)).toBe(2026)
    },
  )

  it('включает сами границы', () => {
    expect(queryIntInRange('2010', 2010, 2027, 2026)).toBe(2010)
    expect(queryIntInRange('2027', 2010, 2027, 2026)).toBe(2027)
  })
})

describe('pickQuery', () => {
  it('достаёт параметр по имени', () => {
    expect(pickQuery({ search: 'Лавр', page: '2' }, 'search')).toBe('Лавр')
  })

  it('на отсутствующем параметре отдаёт пустую строку', () => {
    expect(pickQuery({}, 'search')).toBe('')
  })
})
