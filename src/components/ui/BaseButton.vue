<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    to?: RouteLocationRaw
    disabled?: boolean
    loading?: boolean
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    to: undefined,
  },
)

const tag = computed(() => (props.to ? 'RouterLink' : 'button'))
const isInteractiveDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <component
    :is="tag"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'is-loading': loading }]"
    :to="to"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? isInteractiveDisabled : undefined"
    :aria-disabled="tag !== 'button' && isInteractiveDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot name="icon" />
    <span v-if="$slots.default" class="btn__label"><slot /></span>
  </component>
</template>

<style scoped>
.btn {
  --btn-bg: var(--bg-elevated);
  --btn-color: var(--text);
  --btn-border: var(--border-strong);
  --btn-bg-hover: var(--bg-subtle);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  height: 40px;
  font-size: var(--text-sm);
  font-weight: 560;
  line-height: 1;
  white-space: nowrap;
  color: var(--btn-color);
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition),
    transform var(--transition),
    box-shadow var(--transition);
}

.btn:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-bg-hover);
  text-decoration: none;
}

.btn:active:not(:disabled):not([aria-disabled='true']) {
  transform: translateY(1px);
}

.btn:disabled,
.btn[aria-disabled='true'] {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--primary {
  --btn-bg: var(--accent);
  --btn-color: #fff;
  --btn-border: transparent;
  --btn-bg-hover: var(--accent-hover);
  box-shadow: var(--shadow-sm);
}

.btn--danger {
  --btn-bg: var(--danger);
  --btn-color: #fff;
  --btn-border: transparent;
  --btn-bg-hover: var(--danger-hover);
}

.btn--ghost {
  --btn-bg: transparent;
  --btn-border: transparent;
  --btn-color: var(--text-muted);
  --btn-bg-hover: var(--bg-subtle);
}

.btn--subtle {
  --btn-bg: var(--accent-soft);
  --btn-color: var(--accent-text);
  --btn-border: transparent;
  --btn-bg-hover: var(--accent-soft);
}

.btn--subtle:hover:not(:disabled) {
  filter: brightness(0.96);
}

.btn--sm {
  height: 32px;
  padding-inline: var(--space-3);
  font-size: var(--text-xs);
}

.btn--lg {
  height: 46px;
  padding-inline: var(--space-5);
  font-size: var(--text-base);
}

.btn--block {
  width: 100%;
}

.btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.btn__label {
  display: inline-block;
}
</style>
