<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { hueFromString, initials } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    src?: string
    title: string
    /** card — в списке, detail — крупная на странице книги. */
    size?: 'card' | 'detail'
  }>(),
  { size: 'card' },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => !!props.src && !failed.value)
const hue = computed(() => hueFromString(props.title))
const placeholderStyle = computed(() => ({
  background: `linear-gradient(145deg, hsl(${hue.value} 62% 62%), hsl(${(hue.value + 48) % 360} 58% 46%))`,
}))
</script>

<template>
  <div class="cover" :class="`cover--${size}`">
    <img
      v-if="showImage"
      class="cover__image"
      :src="src"
      :alt="`Обложка книги «${title}»`"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <div v-else class="cover__placeholder" :style="placeholderStyle" role="img" :aria-label="`Обложка книги «${title}» отсутствует`">
      <span class="cover__initials">{{ initials(title) }}</span>
    </div>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
}

.cover--detail {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.cover__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.cover__initials {
  font-size: clamp(1.2rem, 22cqw, 3rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 92%);
  text-shadow: 0 1px 3px rgb(0 0 0 / 25%);
}

.cover--detail .cover__initials {
  font-size: 3.5rem;
}
</style>
