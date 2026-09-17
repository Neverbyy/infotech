<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useToastsStore } from '@/stores/toasts'
import AppIcon from './AppIcon.vue'

const toasts = useToastsStore()
const { items } = storeToRefs(toasts)
</script>

<template>
  <Teleport to="body">
    <div class="toasts" role="region" aria-label="Уведомления" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="toast in items" :key="toast.id" class="toast" :class="`toast--${toast.kind}`">
          <span class="toast__icon" aria-hidden="true">
            <svg v-if="toast.kind === 'success'" viewBox="0 0 20 20">
              <path
                d="M5 10.5l3.2 3.2L15 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg v-else-if="toast.kind === 'error'" viewBox="0 0 20 20">
              <path
                d="M10 6v5m0 3h.01"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
              />
              <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4" />
            </svg>
            <svg v-else viewBox="0 0 20 20">
              <path d="M10 9v5m0-8h.01" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </span>

          <p class="toast__text">{{ toast.text }}</p>

          <button
            class="icon-action toast__close"
            type="button"
            aria-label="Закрыть"
            @click="toasts.dismiss(toast.id)"
          >
            <AppIcon name="close" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(380px, calc(100vw - 2 * var(--space-4)));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-faint);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.toast--success {
  border-left-color: var(--success);
}

.toast--error {
  border-left-color: var(--danger);
}

.toast--info {
  border-left-color: var(--accent);
}

.toast__icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.toast__icon svg {
  width: 18px;
  height: 18px;
}

.toast--success .toast__icon {
  color: var(--success-text);
}

.toast--error .toast__icon {
  color: var(--danger-text);
}

.toast--info .toast__icon {
  color: var(--accent-text);
}

.toast__text {
  flex: 1;
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.toast__close {
  --icon-action-size: 24px;
  --icon-size: 14px;

  flex-shrink: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--transition),
    transform var(--transition);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.toast-move {
  transition: transform var(--transition);
}
</style>
