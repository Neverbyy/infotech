// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

import { handlers } from './handlers'

/**
 * Страховка от расхождения мока со спецификацией: каждая операция из
 * api/*.yaml должна иметь обработчик, и наоборот — лишних ручек быть не должно.
 * Если в book.yaml появится новый эндпоинт, тест упадёт до того, как
 * несоответствие заметят на код-ревью.
 */

const BASE = '/api/v1'
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

interface OpenApiDocument {
  paths: Record<string, Record<string, unknown>>
}

function loadSpec(relativePath: string): OpenApiDocument {
  const file = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return parse(readFileSync(file, 'utf8')) as OpenApiDocument
}

/** /books/{id} → /api/v1/books/:id — так пути записаны в обработчиках MSW. */
function toHandlerPath(specPath: string): string {
  return `${BASE}${specPath.replace(/\{(\w+)\}/g, ':$1')}`
}

function specOperations(relativePath: string): string[] {
  const spec = loadSpec(relativePath)
  const operations: string[] = []

  for (const [specPath, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method]) operations.push(`${method.toUpperCase()} ${toHandlerPath(specPath)}`)
    }
  }

  return operations.sort()
}

const implemented = handlers
  .map((handler) => `${handler.info.method} ${String(handler.info.path)}`)
  .sort()

describe('мок покрывает спецификацию', () => {
  it('реализует все операции book.yaml', () => {
    const required = specOperations('api/book.yaml')

    expect(required.length).toBeGreaterThan(0)
    expect(implemented).toEqual(expect.arrayContaining(required))
  })

  it('реализует все операции дополнения о подписках и SMS', () => {
    const required = specOperations('api/subscriptions.addendum.yaml')

    expect(required.length).toBeGreaterThan(0)
    expect(implemented).toEqual(expect.arrayContaining(required))
  })

  it('не содержит ручек, которых нет ни в одной спецификации', () => {
    const documented = new Set([
      ...specOperations('api/book.yaml'),
      ...specOperations('api/subscriptions.addendum.yaml'),
    ])

    expect(implemented.filter((operation) => !documented.has(operation))).toEqual([])
  })
})
