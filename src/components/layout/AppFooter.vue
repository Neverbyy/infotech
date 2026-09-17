<script setup lang="ts">
import { useToastsStore } from '@/stores/toasts'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'
const toasts = useToastsStore()

/** Сбрасывает демо-данные мока: он хранит их в localStorage между перезагрузками. */
function resetMockData(): void {
  try {
    localStorage.removeItem('catalog.mock.db')
  } catch {
    /* хранилище недоступно */
  }
  toasts.info('Демо-данные сброшены, перезагружаем страницу…')
  setTimeout(() => window.location.reload(), 600)
}
</script>

<template>
  <footer class="footer">
    <div class="container footer__inner">

      <div class="footer__meta">
        <span v-if="useMock" class="badge" title="Запросы обслуживает MSW, реальный бэкенд не нужен">
          <span class="badge__dot" aria-hidden="true" />
          Демо-режим
        </span>
        <button v-if="useMock" class="footer__reset" type="button" @click="resetMockData">
          Сбросить данные
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: auto;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: var(--space-4);
}

.footer__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px var(--space-3);
  font-size: var(--text-xs);
  font-weight: 560;
  color: var(--success-text);
  background: var(--success-soft);
  border-radius: var(--radius-full);
}

.badge__dot {
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
}

.footer__reset {
  padding: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
}

.footer__reset:hover {
  color: var(--text);
}
</style>
