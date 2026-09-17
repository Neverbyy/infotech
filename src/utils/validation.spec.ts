import { describe, expect, it } from 'vitest'

import {
  MAX_BOOK_YEAR,
  errorsToFieldMap,
  hasErrors,
  normalizePhone,
  validateAuthorForm,
  validateBookForm,
  validateCover,
  validateIsbn,
  validateLoginForm,
  validatePhone,
  type BookFormValues,
} from './validation'

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  // File.size только для чтения — подменяем для проверки лимита.
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const validValues = (overrides: Partial<BookFormValues> = {}): BookFormValues => ({
  title: 'Пикник на обочине',
  year: '2021',
  description: '',
  isbn: '',
  author_ids: [1],
  cover: makeFile('cover.jpg', 'image/jpeg', 1024),
  ...overrides,
})

describe('validateBookForm', () => {
  it('не находит ошибок в корректной форме', () => {
    expect(validateBookForm(validValues())).toEqual({})
  })

  it('требует название', () => {
    expect(validateBookForm(validValues({ title: '   ' })).title).toBe('Укажите название книги')
  })

  it('требует хотя бы одного автора', () => {
    expect(validateBookForm(validValues({ author_ids: [] })).author_ids).toBeDefined()
  })

  it('отвергает год за пределами диапазона', () => {
    expect(validateBookForm(validValues({ year: '1200' })).year).toBeDefined()
    expect(validateBookForm(validValues({ year: String(MAX_BOOK_YEAR + 1) })).year).toBeDefined()
  })

  it('отвергает нецелый год', () => {
    expect(validateBookForm(validValues({ year: '20.5' })).year).toBe('Год — целое число')
  })

  it('требует обложку для новой книги', () => {
    expect(validateBookForm(validValues({ cover: null })).cover).toBe('Загрузите обложку')
  })

  it('разрешает не загружать обложку, если она уже есть', () => {
    const errors = validateBookForm(validValues({ cover: null, hasExistingCover: true }))
    expect(errors.cover).toBeUndefined()
  })
})

describe('validateCover', () => {
  it('отвергает неподдерживаемый тип файла', () => {
    expect(validateCover(makeFile('doc.pdf', 'application/pdf', 100), false)).toBe(
      'Допустимы JPEG, PNG, WebP или GIF',
    )
  })

  it('отвергает файл больше 5 МБ', () => {
    expect(validateCover(makeFile('big.png', 'image/png', 6 * 1024 * 1024), false)).toBe('Файл больше 5 МБ')
  })

  it('принимает корректный файл', () => {
    expect(validateCover(makeFile('ok.webp', 'image/webp', 2048), false)).toBeNull()
  })
})

describe('validateIsbn', () => {
  it('считает пустое значение допустимым — поле необязательное', () => {
    expect(validateIsbn('')).toBeNull()
  })

  it('принимает корректный ISBN-13 с дефисами', () => {
    expect(validateIsbn('978-5-17-114732-7')).toBeNull()
  })

  it('принимает корректный ISBN-10 с контрольным X', () => {
    expect(validateIsbn('097522980X')).toBeNull()
  })

  it('отвергает неверную контрольную сумму', () => {
    expect(validateIsbn('978-5-17-114732-8')).toBe('Неверная контрольная сумма ISBN')
  })

  it('отвергает неверную длину', () => {
    expect(validateIsbn('12345')).toBe('Формат ISBN-10 или ISBN-13')
  })
})

describe('validateAuthorForm', () => {
  it('требует ФИО', () => {
    expect(validateAuthorForm('  ').full_name).toBe('Укажите ФИО автора')
  })

  it('принимает нормальное ФИО', () => {
    expect(validateAuthorForm('Иванов Иван')).toEqual({})
  })
})

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['79991234567', '79991234567'],
    ['9991234567', '79991234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it('не выдумывает код страны для мусора', () => {
    expect(normalizePhone('123')).toBe('123')
  })
})

describe('validatePhone', () => {
  it.each([
    ['', 'Укажите номер телефона'],
    ['123', 'Формат: +7 999 123-45-67'],
    ['+7 999 123-45-6', 'Формат: +7 999 123-45-67'],
    ['не телефон', 'Формат: +7 999 123-45-67'],
  ])('отвергает «%s»', (input, message) => {
    expect(validatePhone(input)).toBe(message)
  })

  it.each(['+7 (999) 123-45-67', '8 999 123 45 67', '79991234567'])('принимает %s', (input) => {
    expect(validatePhone(input)).toBeNull()
  })
})

describe('validateLoginForm', () => {
  it('требует оба поля', () => {
    expect(validateLoginForm('', '')).toEqual({
      username: 'Укажите логин',
      password: 'Укажите пароль',
    })
  })
})

describe('errorsToFieldMap', () => {
  it('складывает ответ 422 в карту «поле → сообщение»', () => {
    const map = errorsToFieldMap([
      { field: 'title', message: 'Название обязательно' },
      { field: 'year', message: 'Год обязателен' },
      { message: 'Общая ошибка' },
    ])
    expect(map).toEqual({ title: 'Название обязательно', year: 'Год обязателен' })
  })

  it('оставляет первое сообщение, если поле повторяется', () => {
    const map = errorsToFieldMap([
      { field: 'isbn', message: 'Первое' },
      { field: 'isbn', message: 'Второе' },
    ])
    expect(map.isbn).toBe('Первое')
  })
})

describe('hasErrors', () => {
  it('различает пустую и заполненную карту', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ title: 'ошибка' })).toBe(true)
  })
})
