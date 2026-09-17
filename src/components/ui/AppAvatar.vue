<script setup lang="ts">
import { computed } from 'vue'

/**
 * Круглая аватарка из первой буквы имени.
 *
 * Намеренно не использует initials() из utils/format: та отдаёт две буквы
 * и нужна обложкам книг, а здесь по всему интерфейсу показывается одна.
 */

const props = withDefaults(
  defineProps<{
    name: string
    /** sm — строка списка, md — карточка, lg — шапка страницы. */
    size?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const letter = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
</script>

<template>
  <span class="avatar" :class="`avatar--${size}`" aria-hidden="true">{{ letter }}</span>
</template>

<style scoped>
.avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-weight: 650;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 50%;
}

.avatar--xs {
  width: 26px;
  height: 26px;
  font-size: var(--text-xs);
}

.avatar--sm {
  width: 38px;
  height: 38px;
  font-size: var(--text-sm);
}

.avatar--md {
  width: 40px;
  height: 40px;
  font-size: var(--text-base);
}

.avatar--lg {
  width: 64px;
  height: 64px;
  font-size: var(--text-2xl);
}
</style>
