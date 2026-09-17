<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
</script>

<template>
  <div class="container page not-found">
    <p class="code" aria-hidden="true">404</p>
    <h1>Страница не найдена</h1>
    <p class="muted">Похоже, такой страницы нет. Проверьте адрес или вернитесь в каталог.</p>

    <div class="actions">
      <BaseButton variant="primary" :to="{ name: 'books' }">К каталогу книг</BaseButton>
      <BaseButton variant="ghost" :to="{ name: 'authors' }">К авторам</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding-block: var(--space-7);
  text-align: center;
}

.code {
  font-size: clamp(4rem, 14vw, 7rem);
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.04em;
  color: transparent;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #22d3ee));
  background-clip: text;
  -webkit-background-clip: text;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
</style>
