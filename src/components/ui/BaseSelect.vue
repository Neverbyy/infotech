<script setup lang="ts">
import BaseField from './BaseField.vue'

export interface SelectOption {
  value: string | number
  label: string
}

defineProps<{
  label?: string
  error?: string
  disabled?: boolean
  options: SelectOption[]
  placeholder?: string
  /** Для селектов без видимой подписи (фильтры в строке поиска). */
  ariaLabel?: string
}>()

const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <BaseField :label="label" :error="error">
    <template #default="{ id, describedBy, invalid }">
      <div class="select">
        <select
          :id="id"
          v-model="model"
          class="text-control select__control"
          :disabled="disabled"
          :aria-label="label ? undefined : ariaLabel"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        >
          <option v-if="placeholder" value="">{{ placeholder }}</option>
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <svg class="select__chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </div>
    </template>
  </BaseField>
</template>

<style scoped>
.select {
  position: relative;
  display: flex;
  align-items: center;
}

/* Базовый вид — в .text-control (main.css), здесь только про выпадающий список. */
.select__control {
  padding-right: 34px;
  appearance: none;
  cursor: pointer;
}

.select__chevron {
  position: absolute;
  right: var(--space-3);
  width: 18px;
  height: 18px;
  color: var(--text-faint);
  pointer-events: none;
}
</style>
