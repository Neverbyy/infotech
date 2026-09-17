import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const LIFETIME_MS = 4500

export const useToastsStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextId = 1

  function dismiss(id: number): void {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    items.value = items.value.filter((toast) => toast.id !== id)
  }

  function push(kind: ToastKind, text: string): number {
    const id = nextId++
    items.value = [...items.value, { id, kind, text }]
    timers.set(
      id,
      setTimeout(() => dismiss(id), LIFETIME_MS),
    )
    return id
  }

  const success = (text: string) => push('success', text)
  const error = (text: string) => push('error', text)
  const info = (text: string) => push('info', text)

  return { items, push, success, error, info, dismiss }
})
