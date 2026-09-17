<script setup lang="ts">
withDefaults(
  defineProps<{
    /** empty — «ничего не найдено», error — ошибка загрузки. */
    kind?: 'empty' | 'error'
    title: string
    description?: string
  }>(),
  { kind: 'empty' },
)
</script>

<template>
  <div class="state" :class="`state--${kind}`" role="status">
    <div class="state__icon" aria-hidden="true">
      <svg v-if="kind === 'error'" viewBox="0 0 24 24">
        <path
          d="M12 8v5m0 3.5h.01M10.3 3.9L2.6 17.1a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg v-else viewBox="0 0 24 24">
        <path
          d="M4 5.5A1.5 1.5 0 015.5 4H10l2 2h6.5A1.5 1.5 0 0120 7.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-13z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <h3 class="state__title">{{ title }}</h3>
    <p v-if="description" class="state__description">{{ description }}</p>

    <div v-if="$slots.default" class="state__actions"><slot /></div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-7) var(--space-4);
  text-align: center;
  background: var(--bg-elevated);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  animation: fade-up 240ms ease both;
}

.state--error {
  border-style: solid;
  border-color: var(--danger-soft);
  background: var(--danger-soft);
}

.state__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-1);
  color: var(--text-faint);
  background: var(--bg-subtle);
  border-radius: var(--radius-full);
}

.state--error .state__icon {
  color: var(--danger-text);
  background: var(--bg-elevated);
}

.state__icon svg {
  width: 24px;
  height: 24px;
}

.state__title {
  font-size: var(--text-lg);
}

.state--error .state__title {
  color: var(--danger-text);
}

.state__description {
  max-width: 46ch;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.state--error .state__description {
  color: var(--danger-text);
  opacity: 0.85;
}

.state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
</style>
