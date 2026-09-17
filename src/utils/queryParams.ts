import type { LocationQuery, LocationQueryValue } from 'vue-router'

/**
 * Разбор query-параметров. Фильтры списков и год отчёта живут в URL, поэтому
 * приходят строками либо массивами строк и требуют одинаковой нормализации.
 */

export type QueryValue = LocationQueryValue | LocationQueryValue[] | undefined

/** ?x=a&x=b — берём первое: повторы в наших ссылках смысла не имеют. */
export function queryString(value: QueryValue): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

/** Положительное целое либо null: page, per-page, author_id, year. */
export function queryInt(value: QueryValue): number | null {
  const parsed = Number(queryString(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/** Целое в границах либо запасное значение — для года отчёта. */
export function queryIntInRange(value: QueryValue, min: number, max: number, fallback: number): number {
  const parsed = queryInt(value)
  return parsed !== null && parsed >= min && parsed <= max ? parsed : fallback
}

/** Строковый параметр по имени. */
export function pickQuery(query: LocationQuery, key: string): string {
  return queryString(query[key])
}
