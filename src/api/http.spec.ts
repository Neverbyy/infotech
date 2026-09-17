import { describe, expect, it } from 'vitest'

import { ApiError, buildQuery } from './http'

describe('buildQuery', () => {
  it('возвращает пустую строку, когда параметров нет', () => {
    expect(buildQuery()).toBe('')
    expect(buildQuery({})).toBe('')
  })

  it('выбрасывает пустые значения', () => {
    expect(buildQuery({ page: 1, search: '', author_id: null, year: undefined })).toBe('?page=1')
  })

  it('сохраняет дефис в имени параметра per-page из спеки', () => {
    expect(buildQuery({ 'per-page': 20 })).toBe('?per-page=20')
  })

  it('кодирует значения', () => {
    expect(buildQuery({ search: 'Пикник на обочине' })).toBe(
      '?search=%D0%9F%D0%B8%D0%BA%D0%BD%D0%B8%D0%BA+%D0%BD%D0%B0+%D0%BE%D0%B1%D0%BE%D1%87%D0%B8%D0%BD%D0%B5',
    )
  })

  it('передаёт нулевые числа, но не пустые строки', () => {
    expect(buildQuery({ year: 0, search: '' })).toBe('?year=0')
  })
})

describe('ApiError', () => {
  it('берёт сообщение из первой ошибки', () => {
    const error = new ApiError(422, [{ field: 'title', message: 'Название обязательно' }])
    expect(error.message).toBe('Название обязательно')
  })

  it('подставляет сообщение по статусу, если errors пуст', () => {
    expect(new ApiError(403, []).message).toBe('Недостаточно прав')
    expect(new ApiError(404, []).message).toBe('Не найдено')
    expect(new ApiError(0, []).message).toBe('Сервер недоступен. Проверьте подключение')
    expect(new ApiError(500, []).message).toBe('Ошибка на стороне сервера')
  })

  it('раскладывает ошибки по полям', () => {
    const error = new ApiError(422, [
      { field: 'title', message: 'Название обязательно' },
      { field: 'year', message: 'Год обязателен' },
      { message: 'Что-то пошло не так' },
    ])
    expect(error.fieldErrors).toEqual({ title: 'Название обязательно', year: 'Год обязателен' })
    expect(error.generalErrors).toEqual(['Что-то пошло не так'])
  })

  it('возвращает собственное сообщение как общую ошибку, если errors пуст', () => {
    expect(new ApiError(500, []).generalErrors).toEqual(['Ошибка на стороне сервера'])
  })

  it('различает статусы через геттеры', () => {
    expect(new ApiError(401, []).isUnauthorized).toBe(true)
    expect(new ApiError(403, []).isForbidden).toBe(true)
    expect(new ApiError(404, []).isNotFound).toBe(true)
    expect(new ApiError(422, []).isValidation).toBe(true)
    expect(new ApiError(422, []).isNotFound).toBe(false)
  })
})
