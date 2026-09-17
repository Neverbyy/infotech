<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const fieldId = useId()
const describedBy = `${fieldId}-desc`
</script>

<template>
  <div class="field" :class="{ 'field--invalid': !!error }">
    <label v-if="label" class="field__label" :for="fieldId">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <slot :id="fieldId" :described-by="describedBy" :invalid="!!error" />

    <p v-if="error" :id="describedBy" class="field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="describedBy" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.field__label {
  font-size: var(--text-sm);
  font-weight: 560;
  color: var(--text);
}

.field__required {
  color: var(--danger);
  margin-left: 2px;
}

.field__error {
  font-size: var(--text-xs);
  color: var(--danger-text);
}

.field__hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
