<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    radius?: string
    circle?: boolean
  }>(),
  { width: '100%', height: '1em', radius: 'var(--radius-sm)' },
)
</script>

<template>
  <span
    class="skeleton"
    :style="{ width, height, borderRadius: circle ? '50%' : radius }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--bg-subtle);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 45%), transparent);
  animation: shimmer 1.4s infinite;
}

:global(:root[data-theme='dark']) .skeleton::after {
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 7%), transparent);
}
</style>
