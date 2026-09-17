import { ref } from 'vue'

import { ApiError } from '@/api/http'
import { errorMessage } from '@/utils/errors'
import { errorsToFieldMap, type FieldErrors } from '@/utils/validation'

/**
 * Состояние ошибок формы: подсветка полей плюс общий блок над формой.
 *
 * Ответ 422 раскладываем по полям — серверные сообщения главнее клиентских,
 * потому что сервер знает про уникальность ISBN и дубли ФИО, а клиент нет.
 */
export function useFormErrors(fallback: string) {
  const errors = ref<FieldErrors>({})
  const generalErrors = ref<string[]>([])
  const submitting = ref(false)

  function clear(): void {
    errors.value = {}
    generalErrors.value = []
  }

  /**
   * Разбирает пойманную ошибку и возвращает текст для уведомления.
   *
   * Именно возвращает, а не показывает сам: форма книги тост выводит, а
   * модалка автора — нет, и композабл не должен навязывать им поведение.
   */
  function capture(caught: unknown): string {
    if (caught instanceof ApiError && caught.isValidation) {
      errors.value = errorsToFieldMap(caught.errors)
      generalErrors.value = caught.generalErrors
      return 'Сервер отклонил данные формы'
    }

    const message = errorMessage(caught, fallback)
    generalErrors.value = [message]
    return message
  }

  /** Отправка с флагом submitting: без finally легко оставить кнопку залипшей. */
  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    submitting.value = true
    try {
      return await action()
    } catch (caught) {
      capture(caught)
      return null
    } finally {
      submitting.value = false
    }
  }

  return { errors, generalErrors, submitting, clear, capture, run }
}
