import type { ErrorItem } from '@/types/api'

/**
 * Клиентская валидация форм. Серверные 422 всё равно имеют приоритет.
 *
 * Часть правил намеренно повторена в моке (src/mocks/handlers.ts): он изображает
 * независимый бэкенд, и общая реализация обесценила бы контрактные тесты.
 */

export type FieldErrors = Record<string, string>

export const MAX_COVER_SIZE = 5 * 1024 * 1024
export const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const MIN_BOOK_YEAR = 1450
export const MAX_BOOK_YEAR = new Date().getFullYear() + 1

export interface BookFormValues {
  title: string
  year: string
  description: string
  isbn: string
  author_ids: number[]
  cover: File | null
  /** У существующей книги обложка уже загружена — новый файл необязателен. */
  hasExistingCover?: boolean
}

export function validateBookForm(values: BookFormValues): FieldErrors {
  const errors: FieldErrors = {}

  const title = values.title.trim()
  if (!title) errors.title = 'Укажите название книги'
  else if (title.length > 255) errors.title = 'Не длиннее 255 символов'

  if (!values.year.trim()) {
    errors.year = 'Укажите год выпуска'
  } else {
    const year = Number(values.year)
    if (!Number.isInteger(year)) errors.year = 'Год — целое число'
    else if (year < MIN_BOOK_YEAR || year > MAX_BOOK_YEAR)
      errors.year = `Год должен быть в диапазоне ${MIN_BOOK_YEAR}–${MAX_BOOK_YEAR}`
  }

  if (values.author_ids.length === 0) errors.author_ids = 'Выберите хотя бы одного автора'

  const isbnError = validateIsbn(values.isbn)
  if (isbnError) errors.isbn = isbnError

  if (values.description.length > 5000) errors.description = 'Не длиннее 5000 символов'

  const coverError = validateCover(values.cover, values.hasExistingCover ?? false)
  if (coverError) errors.cover = coverError

  return errors
}

export function validateCover(cover: File | null, hasExistingCover: boolean): string | null {
  if (!cover) return hasExistingCover ? null : 'Загрузите обложку'
  if (!ALLOWED_COVER_TYPES.includes(cover.type)) return 'Допустимы JPEG, PNG, WebP или GIF'
  if (cover.size > MAX_COVER_SIZE) return 'Файл больше 5 МБ'
  return null
}

/** ISBN необязателен, но если введён — проверяем контрольную сумму ISBN-10/13. */
export function validateIsbn(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const clean = value.replace(/[\s-]/g, '').toUpperCase()
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(clean)) return 'Формат ISBN-10 или ISBN-13'

  if (clean.length === 10) {
    let sum = 0
    for (let i = 0; i < 10; i += 1) {
      const char = clean[i]!
      const digit = char === 'X' ? 10 : Number(char)
      sum += digit * (10 - i)
    }
    return sum % 11 === 0 ? null : 'Неверная контрольная сумма ISBN'
  }

  let sum = 0
  for (let i = 0; i < 13; i += 1) {
    sum += Number(clean[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0 ? null : 'Неверная контрольная сумма ISBN'
}

export function validateAuthorForm(fullName: string): FieldErrors {
  const errors: FieldErrors = {}
  const value = fullName.trim()
  if (!value) errors.full_name = 'Укажите ФИО автора'
  else if (value.length < 2) errors.full_name = 'Слишком короткое значение'
  else if (value.length > 255) errors.full_name = 'Не длиннее 255 символов'
  return errors
}

/**
 * Приводит номер к формату SMS-шлюза: 11 цифр, начинается с 7.
 * Принимает +7…, 8…, 7… и десятизначный номер без кода страны.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')

  // Код страны указан явно: +7…, 7…, 8…
  if (digits.length === 11 && /^[78]/.test(digits)) return `7${digits.slice(1)}`

  // Десять цифр без кода страны. Если ввод начинался с «+» или с 7/8, значит
  // код уже был и номер просто недобран, — достраивать его нельзя.
  if (digits.length === 10 && !trimmed.startsWith('+') && !/^[78]/.test(digits)) return `7${digits}`

  return digits
}

export function validatePhone(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Укажите номер телефона'
  if (!/^7\d{10}$/.test(normalizePhone(value))) return 'Формат: +7 999 123-45-67'
  return null
}

export function validateLoginForm(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!username.trim()) errors.username = 'Укажите логин'
  if (!password) errors.password = 'Укажите пароль'
  return errors
}

/** Превращает errors[] из ответа 422 в карту «поле → сообщение». */
export function errorsToFieldMap(errors: ErrorItem[]): FieldErrors {
  const map: FieldErrors = {}
  for (const item of errors) {
    if (item.field && !map[item.field]) map[item.field] = item.message
  }
  return map
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
