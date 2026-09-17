<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'

import { ALLOWED_COVER_TYPES } from '@/utils/validation'

const props = defineProps<{
  /** Уже загруженная обложка (при редактировании книги). */
  existingUrl?: string
  error?: string
  hint?: string
  disabled?: boolean
}>()

const model = defineModel<File | null>({ default: null })

const inputId = useId()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const objectUrl = ref<string | null>(null)

const previewUrl = computed(() => objectUrl.value ?? props.existingUrl ?? null)
const accept = ALLOWED_COVER_TYPES.join(',')

function releaseObjectUrl(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

watch(model, (file) => {
  releaseObjectUrl()
  if (file) objectUrl.value = URL.createObjectURL(file)
})

onBeforeUnmount(releaseObjectUrl)

function onPick(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  model.value = file
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  if (props.disabled) return
  const file = event.dataTransfer?.files?.[0]
  if (file) model.value = file
}

function clear(): void {
  releaseObjectUrl()
  model.value = null
  if (input.value) input.value.value = ''
}

const sizeLabel = computed(() => {
  if (!model.value) return ''
  const kb = model.value.size / 1024
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${Math.round(kb)} КБ`
})
</script>

<template>
  <div class="uploader" :class="{ 'uploader--invalid': !!error }">
    <span class="uploader__label">Обложка</span>

    <div class="uploader__row">
      <div v-if="previewUrl" class="uploader__preview">
        <img :src="previewUrl" alt="Предпросмотр обложки" />
      </div>

      <label
        class="dropzone"
        :class="{ 'is-dragging': dragging, 'is-disabled': disabled }"
        :for="inputId"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <svg class="dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 16V4m0 0L8 8m4-4l4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="dropzone__text">
          <strong>Выберите файл</strong> или перетащите сюда
        </span>
        <span class="dropzone__meta">JPEG, PNG, WebP или GIF · до 5 МБ</span>

        <input
          :id="inputId"
          ref="input"
          class="visually-hidden"
          type="file"
          :accept="accept"
          :disabled="disabled"
          :aria-invalid="!!error || undefined"
          @change="onPick"
        />
      </label>
    </div>

    <p v-if="model" class="uploader__file">
      <span class="truncate">{{ model.name }}</span>
      <span class="faint">· {{ sizeLabel }}</span>
      <button type="button" class="uploader__clear" @click="clear">Убрать</button>
    </p>

    <p v-if="error" class="uploader__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="uploader__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.uploader {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.uploader__label {
  font-size: var(--text-sm);
  font-weight: 560;
}

.uploader__row {
  display: flex;
  align-items: stretch;
  gap: var(--space-3);
}

.uploader__preview {
  width: 92px;
  flex-shrink: 0;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.uploader__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dropzone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 120px;
  padding: var(--space-4);
  text-align: center;
  color: var(--text-muted);
  background: var(--bg-inset);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color var(--transition),
    background var(--transition),
    color var(--transition);
}

.dropzone:hover:not(.is-disabled),
.dropzone.is-dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.dropzone:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.dropzone.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.dropzone__icon {
  width: 22px;
  height: 22px;
}

.dropzone__text {
  font-size: var(--text-sm);
}

.dropzone__meta {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.uploader--invalid .dropzone {
  border-color: var(--danger);
}

.uploader__file {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
  min-width: 0;
}

.uploader__clear {
  margin-left: auto;
  padding: 0;
  font-size: var(--text-xs);
  color: var(--danger-text);
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
}

.uploader__error {
  font-size: var(--text-xs);
  color: var(--danger-text);
}

.uploader__hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
