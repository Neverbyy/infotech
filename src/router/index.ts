import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'books' } },

  {
    path: '/books',
    name: 'books',
    component: () => import('@/views/BooksListView.vue'),
    meta: { title: 'Книги' },
  },
  {
    path: '/books/new',
    name: 'book-create',
    component: () => import('@/views/BookEditorView.vue'),
    meta: { title: 'Новая книга', requiresAuth: true },
  },
  {
    path: '/books/:id(\\d+)',
    name: 'book-detail',
    component: () => import('@/views/BookDetailView.vue'),
    props: true,
    meta: { title: 'Книга' },
  },
  {
    path: '/books/:id(\\d+)/edit',
    name: 'book-edit',
    component: () => import('@/views/BookEditorView.vue'),
    props: true,
    meta: { title: 'Редактирование книги', requiresAuth: true },
  },

  {
    path: '/authors',
    name: 'authors',
    component: () => import('@/views/AuthorsListView.vue'),
    meta: { title: 'Авторы' },
  },
  {
    path: '/authors/:id(\\d+)',
    name: 'author-detail',
    component: () => import('@/views/AuthorDetailView.vue'),
    props: true,
    meta: { title: 'Автор' },
  },

  {
    path: '/reports/top-authors',
    name: 'top-authors',
    component: () => import('@/views/TopAuthorsView.vue'),
    meta: { title: 'ТОП-10 авторов' },
  },

  {
    path: '/subscriptions',
    name: 'subscriptions',
    component: () => import('@/views/SubscriptionsView.vue'),
    meta: { title: 'Мои подписки' },
  },

  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Вход', guestOnly: true },
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Страница не найдена' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // Смена страницы в списке не должна отматывать наверх при том же маршруте.
    if (to.name === from.name && to.path === from.path) return
    return { top: 0 }
  },
})

const APP_NAME = 'Книжный каталог'

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'books' }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} — ${APP_NAME}` : APP_NAME
})

export default router
