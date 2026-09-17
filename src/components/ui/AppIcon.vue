<script setup lang="ts">
import { computed } from 'vue'

/**
 * Иконки, встречающиеся в нескольких местах.
 *
 * Сюда попадают только повторяющиеся: у одноразовых декоративных иконок
 * реестр отнимает читаемость, ничего не экономя, — они остаются рядом
 * со своей разметкой.
 */

interface IconDefinition {
  path: string
  strokeWidth: number
}

const ICONS = {
  plus: { path: 'M10 4v12M4 10h12', strokeWidth: 1.8 },
  close: { path: 'M5 5l10 10M15 5L5 15', strokeWidth: 1.6 },
} as const satisfies Record<string, IconDefinition>

export type IconName = keyof typeof ICONS

const props = defineProps<{ name: IconName }>()

const icon = computed(() => ICONS[props.name])
</script>

<template>
  <svg class="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      :d="icon.path"
      fill="none"
      stroke="currentColor"
      :stroke-width="icon.strokeWidth"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
/* Размер задаёт место использования: у кнопок и у полей он разный. */
.icon {
  width: var(--icon-size, 16px);
  height: var(--icon-size, 16px);
}
</style>
