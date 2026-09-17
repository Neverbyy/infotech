<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { Book } from '@/types/api'
import BookCover from './BookCover.vue'

defineProps<{ book: Book }>()
</script>

<template>
  <article class="card">
    <RouterLink class="card__link" :to="{ name: 'book-detail', params: { id: book.id } }">
      <BookCover class="card__cover" :src="book.cover_url" :title="book.title" />
      <span class="card__year">{{ book.year }}</span>
    </RouterLink>

    <div class="card__body">
      <h3 class="card__title">
        <RouterLink :to="{ name: 'book-detail', params: { id: book.id } }">{{ book.title }}</RouterLink>
      </h3>

      <p v-if="book.authors.length" class="card__authors">
        <template v-for="(author, index) in book.authors" :key="author.id">
          <RouterLink class="card__author" :to="{ name: 'author-detail', params: { id: author.id } }">
            {{ author.full_name }}
          </RouterLink><span v-if="index < book.authors.length - 1">, </span>
        </template>
      </p>
      <p v-else class="card__authors faint">Автор не указан</p>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.card__link {
  position: relative;
  display: block;
  border-radius: var(--radius-md);
  transition:
    transform var(--transition),
    box-shadow var(--transition);
}

.card__link:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.card__year {
  position: absolute;
  left: var(--space-2);
  bottom: var(--space-2);
  padding: 2px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: #fff;
  background: rgb(16 18 24 / 66%);
  backdrop-filter: blur(4px);
  border-radius: var(--radius-full);
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.card__title {
  font-size: var(--text-base);
  font-weight: 600;
  line-height: 1.35;
}

.card__title a {
  color: var(--text);
}

.card__title a:hover {
  color: var(--accent-text);
  text-decoration: none;
}

.card__authors {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.card__author {
  color: inherit;
}

.card__author:hover {
  color: var(--accent-text);
}
</style>
