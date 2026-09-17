/**
 * Тонкая обёртка над localStorage: в приватном режиме и при запрете cookie
 * обращение к нему бросает исключение, поэтому каждый вызов защищён.
 */

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* квота исчерпана или хранилище недоступно — молча продолжаем */
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* см. выше */
  }
}
