<script setup lang="ts">
import BaseField from './BaseField.vue'

withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
    required?: boolean
    type?: string
    placeholder?: string
    autocomplete?: string
    disabled?: boolean
    inputmode?: 'text' | 'numeric' | 'email' | 'search' | 'tel'
  }>(),
  { type: 'text' },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <div class="control">
        <span v-if="$slots.prefix" class="control__prefix"><slot name="prefix" /></span>
        <input
          :id="id"
          v-model="model"
          class="text-control control__input"
          :class="{ 'control__input--with-prefix': !!$slots.prefix }"
          :type="type"
          :placeholder="placeholder"
          :autocomplete="autocomplete"
          :disabled="disabled"
          :inputmode="inputmode"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        />
        <span v-if="$slots.suffix" class="control__suffix"><slot name="suffix" /></span>
      </div>
    </template>
  </BaseField>
</template>

<style scoped>
.control {
  position: relative;
  display: flex;
  align-items: center;
}

/* Базовый вид поля — в .text-control (main.css), здесь только доработки. */
.control__input--with-prefix {
  padding-left: 34px;
}

.control__prefix,
.control__suffix {
  position: absolute;
  display: flex;
  align-items: center;
  color: var(--text-faint);
  pointer-events: none;
}

.control__prefix {
  left: var(--space-3);
}

.control__suffix {
  right: var(--space-2);
  pointer-events: auto;
}

/* Убираем стрелки у number — год вводится обычным текстом. */
.control__input[type='number']::-webkit-outer-spin-button,
.control__input[type='number']::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.control__input[type='number'] {
  appearance: textfield;
}
</style>
