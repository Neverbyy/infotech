<script setup lang="ts">
defineProps<{
  placeholder?: string
  /** Подписи рядом с полем нет, поэтому имя обязательно — для скринридера. */
  label: string
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="search">
    <svg class="search__icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      <path d="M13.2 13.2L17 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>

    <input
      v-model="model"
      class="text-control search__input"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
    />
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
}

.search__icon {
  position: absolute;
  left: var(--space-3);
  width: 17px;
  height: 17px;
  color: var(--text-faint);
  pointer-events: none;
}

/* Базовый вид — в .text-control (main.css), здесь только место под иконку. */
.search__input {
  padding-left: 36px;
  background: var(--bg-inset);
}

.search__input::-webkit-search-cancel-button {
  cursor: pointer;
}
</style>
