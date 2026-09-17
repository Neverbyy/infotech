import { computed, ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'

import { readStorage, writeStorage } from '@/utils/storage'

const STORAGE_KEY = 'catalog.theme'

export type Theme = 'light' | 'dark'

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const stored = readStorage<Theme | null>(STORAGE_KEY, null)
  const theme = ref<Theme>(stored ?? systemTheme())

  const isDark = computed(() => theme.value === 'dark')

  function set(next: Theme): void {
    theme.value = next
    writeStorage(STORAGE_KEY, next)
  }

  function toggle(): void {
    set(theme.value === 'dark' ? 'light' : 'dark')
  }

  watchEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.value
  })

  return { theme, isDark, set, toggle }
})
