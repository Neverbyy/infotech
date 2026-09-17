<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export interface Crumb {
  label: string
  /** Без to — это текущая страница, последний элемент цепочки. */
  to?: RouteLocationRaw
}

defineProps<{ items: Crumb[] }>()
</script>

<template>
  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <template v-for="(item, index) in items" :key="index">
      <span v-if="index > 0" aria-hidden="true">/</span>
      <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
      <span v-else class="truncate" aria-current="page">{{ item.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-faint);
  min-width: 0;
}

.breadcrumbs a {
  color: var(--text-muted);
}
</style>
