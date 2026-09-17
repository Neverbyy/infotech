<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useThemeStore } from '@/stores/theme'
import { useToastsStore } from '@/stores/toasts'

const auth = useAuthStore()
const theme = useThemeStore()
const subscriptions = useSubscriptionsStore()
const toasts = useToastsStore()
const router = useRouter()
const route = useRoute()

const { isAuthenticated, username } = storeToRefs(auth)
const { count: subscriptionsCount } = storeToRefs(subscriptions)

const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

function logout(): void {
  auth.logout()
  toasts.info('Вы вышли из аккаунта')
  if (route.meta.requiresAuth) void router.push({ name: 'books' })
}

const links = [
  { name: 'books', label: 'Книги' },
  { name: 'authors', label: 'Авторы' },
  { name: 'top-authors', label: 'ТОП-10 авторов' },
] as const
</script>

<template>
  <header class="header">
    <div class="container header__inner">
      <RouterLink class="brand" :to="{ name: 'books' }">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M4 4.5A1.5 1.5 0 015.5 3H11v18H5.5A1.5 1.5 0 014 19.5v-15zM13 3h5.5A1.5 1.5 0 0120 4.5v15a1.5 1.5 0 01-1.5 1.5H13V3z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="brand__text">Книжный каталог</span>
      </RouterLink>

      <button
        class="burger"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="Меню"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            :d="menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <div class="header__menu" :class="{ 'is-open': menuOpen }">
        <nav class="nav" aria-label="Основная навигация">
          <RouterLink v-for="link in links" :key="link.name" class="nav__link" :to="{ name: link.name }">
            {{ link.label }}
          </RouterLink>
          <RouterLink class="nav__link" :to="{ name: 'subscriptions' }">
            Подписки
            <span v-if="subscriptionsCount" class="nav__badge">{{ subscriptionsCount }}</span>
          </RouterLink>
        </nav>

        <div class="header__actions">
          <button
            class="icon-action icon-btn"
            type="button"
            :aria-label="theme.isDark ? 'Светлая тема' : 'Тёмная тема'"
            :title="theme.isDark ? 'Светлая тема' : 'Тёмная тема'"
            @click="theme.toggle()"
          >
            <svg v-if="theme.isDark" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path
                d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <template v-if="isAuthenticated">
            <span class="user" :title="`Роль: ${auth.role}`">
              <span class="user__avatar" aria-hidden="true">{{ username.slice(0, 1).toUpperCase() }}</span>
              <span class="user__name">{{ username }}</span>
            </span>
            <BaseButton variant="ghost" size="sm" @click="logout">Выйти</BaseButton>
          </template>
          <BaseButton
            v-else
            variant="primary"
            size="sm"
            :to="{ name: 'login', query: { redirect: route.fullPath } }"
          >
            Войти
          </BaseButton>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.header__inner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--header-height);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text);
  font-weight: 680;
  letter-spacing: -0.02em;
  margin-right: auto;
}

.brand:hover {
  text-decoration: none;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: #fff;
  background: var(--accent);
  border-radius: var(--radius-sm);
}

.brand__mark svg {
  width: 18px;
  height: 18px;
}

.header__menu {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.nav__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-weight: 540;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  transition:
    color var(--transition),
    background var(--transition);
}

.nav__link:hover {
  color: var(--text);
  background: var(--bg-subtle);
  text-decoration: none;
}

.nav__link.router-link-active {
  color: var(--accent-text);
  background: var(--accent-soft);
}

.nav__badge {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding-inline: 5px;
  font-size: 11px;
  font-weight: 650;
  color: #fff;
  background: var(--accent);
  border-radius: var(--radius-full);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-btn {
  --icon-action-size: 34px;
  --icon-action-glyph: 19px;

  color: var(--text-muted);
  border-radius: var(--radius-md);
}

.user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 560;
}

.user__avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  font-size: var(--text-xs);
  font-weight: 650;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 50%;
}

.burger {
  display: none;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.burger svg {
  width: 20px;
  height: 20px;
}

@media (max-width: 860px) {
  .burger {
    display: grid;
  }

  .header__menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    display: none;
  }

  .header__menu.is-open {
    display: flex;
    animation: fade-up 180ms ease both;
  }

  .nav {
    flex-direction: column;
    align-items: stretch;
  }

  .nav__link {
    padding: var(--space-3);
  }

  .header__actions {
    justify-content: space-between;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .user__name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
