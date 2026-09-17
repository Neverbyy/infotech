<script setup lang="ts">
import { computed, nextTick } from 'vue'

import BaseField from './BaseField.vue'

/**
 * Поле телефона с маской +7 (999) 123-45-67.
 *
 * Модель хранит номер в формате шлюза — 7XXXXXXXXXX, — а не то, что видно
 * на экране: так родителю не нужно ничего разбирать. Маска пишется руками,
 * а не библиотекой: правило одно, а зависимость тянуть ради него незачем.
 */

defineProps<{
  label?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ blur: [] }>()

/** Номер в формате 7XXXXXXXXXX либо незавершённый ввод («79», «7999»). */
const model = defineModel<string>({ default: '' })

const PREFIX = '+7 ('
const NATIONAL_LENGTH = 10

/** Вытаскивает национальную часть (до 10 цифр), отбрасывая код страны. */
function toNational(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Ведущие 7 или 8 — код страны: он зафиксирован в маске.
  const withoutCountry = /^[78]/.test(digits) ? digits.slice(1) : digits
  return withoutCountry.slice(0, NATIONAL_LENGTH)
}

/**
 * Разделитель добавляется только вместе со следующей цифрой — иначе Backspace
 * стирал бы скобку, маска дорисовывала её обратно, и поле «зависало».
 */
function mask(national: string): string {
  if (!national) return ''
  let result = PREFIX + national.slice(0, 3)
  if (national.length > 3) result += ') ' + national.slice(3, 6)
  if (national.length > 6) result += '-' + national.slice(6, 8)
  if (national.length > 8) result += '-' + national.slice(8, 10)
  return result
}

const display = computed(() => mask(toNational(model.value)))

/**
 * Сколько цифр национальной части стоит левее каретки.
 *
 * Считаем по тому же правилу, что и toNational, а не «пропустим первые
 * четыре символа»: в момент ввода первой цифры в пустое поле префикса «+7 (»
 * там ещё нет, и отсчёт от него дал бы ноль.
 */
function nationalDigitsBefore(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return /^[78]/.test(digits) ? digits.length - 1 : digits.length
}

/** Позиция каретки сразу после n-й национальной цифры. */
function caretAfter(masked: string, count: number): number {
  if (count <= 0) return Math.min(PREFIX.length, masked.length)

  let seen = 0
  for (let index = PREFIX.length; index < masked.length; index += 1) {
    if (!/\d/.test(masked[index]!)) continue
    seen += 1
    if (seen === count) return index + 1
  }
  return masked.length
}

async function onInput(event: Event): Promise<void> {
  const element = event.target as HTMLInputElement
  const caret = element.selectionStart ?? element.value.length

  const digitsBefore = nationalDigitsBefore(element.value.slice(0, caret))
  const pasted = event instanceof InputEvent && event.inputType?.startsWith('insertFrom')

  const national = toNational(element.value)
  const masked = mask(national)

  model.value = national ? `7${national}` : ''
  // Ставим значение сразу: если ввод отфильтрован целиком, модель не изменится
  // и перерисовки не будет — в поле останется мусор.
  element.value = masked

  await nextTick()
  const position = pasted ? masked.length : caretAfter(masked, digitsBefore)
  element.setSelectionRange(position, position)
}
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <input
        :id="id"
        class="text-control"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        placeholder="+7 (999) 123-45-67"
        :value="display"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
        @input="onInput"
        @blur="emit('blur')"
      />
    </template>
  </BaseField>
</template>
