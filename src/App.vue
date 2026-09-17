<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'

import AppFooter from '@/components/layout/AppFooter.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useSubscriptionsStore } from '@/stores/subscriptions'

const subscriptions = useSubscriptionsStore()

// Опрашиваем журнал SMS на уровне приложения: об отправленном уведомлении
// пользователь узнаёт с любой страницы, а не только открыв «Подписки».
onMounted(() => subscriptions.startPolling())
onBeforeUnmount(() => subscriptions.stopPolling())
</script>

<template>
  <div class="app">
    <a class="skip-link" href="#content">Перейти к содержимому</a>

    <AppHeader />

    <main id="content" class="app__main">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <AppFooter />
    <ToastHost />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app__main {
  flex: 1;
}

.skip-link {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: 300;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  transform: translateY(-160%);
  transition: transform var(--transition);
}

.skip-link:focus-visible {
  transform: none;
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
}
</style>
