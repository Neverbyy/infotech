import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/http'
import { errorMessage, isAbortError } from './errors'

describe('errorMessage', () => {
  it('предпочитает сообщение сервера', () => {
    const caught = new ApiError(422, [{ message: 'Книга с таким ISBN уже есть' }])
    expect(errorMessage(caught, 'Не удалось сохранить')).toBe('Книга с таким ISBN уже есть')
  })

  it('подставляет запасное сообщение для не-ApiError', () => {
    expect(errorMessage(new TypeError('boom'), 'Не удалось сохранить')).toBe('Не удалось сохранить')
    expect(errorMessage('строка', 'Не удалось сохранить')).toBe('Не удалось сохранить')
    expect(errorMessage(undefined, 'Не удалось сохранить')).toBe('Не удалось сохранить')
  })

  it('для ApiError без errors[] берёт сообщение по статусу', () => {
    expect(errorMessage(new ApiError(404, []), 'запасное')).toBe('Не найдено')
  })
})

describe('isAbortError', () => {
  it('узнаёт отмену запроса', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true)
  })

  it('не путает с другими ошибками', () => {
    expect(isAbortError(new DOMException('Boom', 'NetworkError'))).toBe(false)
    expect(isAbortError(new ApiError(500, []))).toBe(false)
    expect(isAbortError(new Error('AbortError'))).toBe(false)
  })
})
