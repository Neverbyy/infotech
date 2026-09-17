<script setup lang="ts">
import { computed } from 'vue'

import BaseField from './BaseField.vue'

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
    required?: boolean
    placeholder?: string
    rows?: number
    disabled?: boolean
    maxlength?: number
  }>(),
  { rows: 5 },
)

const model = defineModel<string>({ default: '' })

const counter = computed(() => (props.maxlength ? `${model.value.length} / ${props.maxlength}` : ''))
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <div class="textarea-wrap">
        <textarea
          :id="id"
          v-model="model"
          class="text-control textarea"
          :rows="rows"
          :placeholder="placeholder"
          :disabled="disabled"
          :maxlength="maxlength"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        />
        <span v-if="counter" class="textarea__counter">{{ counter }}</span>
      </div>
    </template>
  </BaseField>
</template>

<style scoped>
.textarea-wrap {
  position: relative;
}

/* Базовый вид — в .text-control (main.css); многострочному полю нужна своя высота. */
.textarea {
  height: auto;
  padding: var(--space-3);
  line-height: 1.6;
  resize: vertical;
}

.textarea__counter {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
  background: var(--bg-elevated);
  padding-left: var(--space-2);
  pointer-events: none;
}
</style>
