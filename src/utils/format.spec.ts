import { describe, expect, it } from 'vitest'

import {
  formatIsbn,
  formatPhone,
  hueFromString,
  initials,
  plural,
  pluralWithCount,
} from './format'

describe('plural', () => {
  const forms: [string, string, string] = ['книга', 'книги', 'книг']

  it.each([
    [1, 'книга'],
    [2, 'книги'],
    [4, 'книги'],
    [5, 'книг'],
    [11, 'книг'],
    [12, 'книг'],
    [21, 'книга'],
    [22, 'книги'],
    [25, 'книг'],
    [101, 'книга'],
    [111, 'книг'],
    [0, 'книг'],
  ])('%i → %s', (count, expected) => {
    expect(plural(count, forms)).toBe(expected)
  })

  it('добавляет число с неразрывным пробелом', () => {
    expect(pluralWithCount(3, forms)).toBe('3 книги')
  })
})

describe('formatIsbn', () => {
  it('расставляет дефисы в ISBN-13', () => {
    expect(formatIsbn('9785171147327')).toBe('978-5-1711-4732-7')
  })

  it('оставляет как есть значение, которое не является 13 цифрами', () => {
    expect(formatIsbn('5-17-114732-1')).toBe('5-17-114732-1')
  })

  it('возвращает пустую строку для пустого значения', () => {
    expect(formatIsbn(undefined)).toBe('')
  })
})

describe('initials', () => {
  it('берёт первые буквы двух слов', () => {
    expect(initials('Пикник на обочине')).toBe('ПН')
  })

  it('работает с одним словом', () => {
    expect(initials('Лавр')).toBe('Л')
  })

  it('не падает на пустой строке', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('hueFromString', () => {
  it('детерминирован', () => {
    expect(hueFromString('Лавр')).toBe(hueFromString('Лавр'))
  })

  it('укладывается в диапазон 0–359', () => {
    const value = hueFromString('Пикник на обочине')
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(360)
  })
})

describe('formatPhone', () => {
  it('раскладывает номер шлюза в читаемый вид', () => {
    expect(formatPhone('79991234567')).toBe('+7 (999) 123-45-67')
  })

  it('возвращает как есть значение, не похожее на российский номер', () => {
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone('')).toBe('')
  })
})

