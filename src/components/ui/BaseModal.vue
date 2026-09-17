<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg'
    closeOnBackdrop?: boolean
  }>(),
  { size: 'md', closeOnBackdrop: true },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let restoreFocus: HTMLElement | null = null

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panel.value) return

  // Фокус не должен уходить за пределы диалога.
  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function lockScroll(locked: boolean): void {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      restoreFocus = document.activeElement as HTMLElement | null
      lockScroll(true)
      await nextTick()
      // data-autofocus может стоять на компоненте-обёртке — тогда ищем внутри неё реальный контрол.
      const marked = panel.value?.querySelector<HTMLElement>('[data-autofocus]')
      const target =
        marked && marked.tabIndex < 0 && !marked.matches('input, textarea, select, button, a[href]')
          ? (marked.querySelector<HTMLElement>('input, textarea, select, button') ?? panel.value)
          : (marked ?? panel.value)
      target?.focus()
    } else {
      lockScroll(false)
      restoreFocus?.focus?.()
      restoreFocus = null
    }
  },
)

onBeforeUnmount(() => lockScroll(false))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="backdrop"
        @click.self="closeOnBackdrop && emit('close')"
        @keydown="onKeydown"
      >
        <div
          ref="panel"
          class="modal"
          :class="`modal--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header v-if="title || $slots.header" class="modal__header">
            <slot name="header">
              <h2 class="modal__title">{{ title }}</h2>
            </slot>
            <button
              class="icon-action modal__close"
              type="button"
              aria-label="Закрыть"
              @click="emit('close')"
            >
              <AppIcon name="close" />
            </button>
          </header>

          <div class="modal__body"><slot /></div>

          <footer v-if="$slots.footer" class="modal__footer"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgb(16 18 24 / 55%);
  backdrop-filter: blur(3px);
}

.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - 2 * var(--space-4));
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal--sm {
  max-width: 420px;
}

.modal--md {
  max-width: 560px;
}

.modal--lg {
  max-width: 820px;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-5) var(--space-3);
}

.modal__title {
  font-size: var(--text-lg);
  font-weight: 650;
}

.modal__close {
  --icon-action-size: 30px;
  --icon-size: 18px;

  flex-shrink: 0;
  color: var(--text-muted);
}

.modal__body {
  padding: var(--space-2) var(--space-5) var(--space-5);
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
  background: var(--bg-inset);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition);
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition:
    transform var(--transition),
    opacity var(--transition);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(12px) scale(0.98);
}

@media (max-width: 560px) {
  .backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .modal {
    max-height: 92vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
</style>
