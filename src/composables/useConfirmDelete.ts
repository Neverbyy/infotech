import { computed, ref, shallowRef } from 'vue'

import { useToastsStore } from '@/stores/toasts'
import { errorMessage } from '@/utils/errors'

/**
 * Удаление с подтверждением: диалог, флаг ожидания, тост об исходе.
 *
 * Хранит цель удаления, потому что в списке удаляется конкретная строка,
 * а не то, что открыто на странице.
 */

export interface ConfirmDeleteOptions<T> {
  remove: (target: T) => Promise<void>
  success: string | ((target: T) => string)
  failure: string
  /** Что сделать после удаления — обычно уход со страницы удалённой сущности. */
  onDone?: (target: T) => void
}

export function useConfirmDelete<T>(options: ConfirmDeleteOptions<T>) {
  const toasts = useToastsStore()

  /* shallowRef, а не ref: для дженерика ref<T | null> разворачивается
     в UnwrapRef<T>, и strict TS перестаёт принимать присваивание. */
  const target = shallowRef<T | null>(null)
  const deleting = ref(false)
  const open = computed(() => target.value !== null)

  function ask(value: T): void {
    target.value = value
  }

  function cancel(): void {
    target.value = null
  }

  async function confirm(): Promise<void> {
    const value = target.value
    if (value === null) return

    deleting.value = true
    try {
      await options.remove(value)
      toasts.success(typeof options.success === 'function' ? options.success(value) : options.success)
      target.value = null
      options.onDone?.(value)
    } catch (caught) {
      toasts.error(errorMessage(caught, options.failure))
      // Диалог закрываем в обоих исходах: ошибка уже показана тостом.
      target.value = null
    } finally {
      deleting.value = false
    }
  }

  return { target, deleting, open, ask, cancel, confirm }
}
