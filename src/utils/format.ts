/** Форматирование значений для UI. */

const NBSP = ' '

/** 1 книга / 2 книги / 5 книг */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100
  const tail = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (tail > 1 && tail < 5) return forms[1]
  if (tail === 1) return forms[0]
  return forms[2]
}

export function pluralWithCount(count: number, forms: [string, string, string]): string {
  return `${count}${NBSP}${plural(count, forms)}`
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** ISBN в человекочитаемом виде, если бэкенд прислал без дефисов. */
export function formatIsbn(isbn: string | undefined): string {
  if (!isbn) return ''
  const digits = isbn.replace(/[^0-9Xx]/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12)}`
  }
  return isbn
}

/** Инициалы для заглушки обложки: «Мастер и Маргарита» → «МИ». */
export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '')
  return letters.join('')
}

/** Детерминированный hue из строки — чтобы у книги всегда был один и тот же цвет заглушки. */
export function hueFromString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360
  }
  return hash
}

/** 79991234567 → +7 (999) 123-45-67. Нераспознанное значение возвращает как есть. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!/^7\d{10}$/.test(digits)) return phone
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
}
