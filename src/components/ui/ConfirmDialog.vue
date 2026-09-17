<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    loading?: boolean
  }>(),
  { confirmLabel: 'Подтвердить' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" size="sm" :close-on-backdrop="!loading" @close="emit('cancel')">
    <p class="message">{{ message }}</p>

    <template #footer>
      <BaseButton variant="ghost" :disabled="loading" @click="emit('cancel')">Отмена</BaseButton>
      <BaseButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="loading"
        data-autofocus
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.message {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
