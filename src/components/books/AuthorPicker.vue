<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'

import AuthorFormModal from '@/components/authors/AuthorFormModal.vue'
import { useAuthorsStore } from '@/stores/authors'
import type { Author, AuthorShort } from '@/types/api'

const props = defineProps<{
  /** Имена уже выбранных авторов — при редактировании приходят из book.authors. */
  preselected?: AuthorShort[]
  error?: string
  disabled?: boolean
}>()

const model = defineModel<number[]>({ default: () => [] })

const authorsStore = useAuthorsStore()

const rootId = useId()
const root = ref<HTMLElement | null>(null)
const search = ref('')
const options = ref<AuthorShort[]>([])
const loading = ref(false)
const open = ref(false)
const createOpen = ref(false)
const activeIndex = ref(-1)

/** Кэш «id → ФИО»: выбранный автор может отсутствовать в текущей выдаче поиска. */
const known = ref(new Map<number, string>())

watch(
  () => props.preselected,
  (list) => {
    for (const author of list ?? []) known.value.set(author.id, author.full_name)
  },
  // deep не нужен: родитель всегда присваивает новый массив, элементы не мутирует.
  { immediate: true },
)

const selected = computed(() =>
  model.value.map((id) => ({ id, full_name: known.value.get(id) ?? `Автор #${id}` })),
)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current

  loading.value = true
  try {
    const list = await authorsStore.suggest(search.value, current.signal)
    if (current.signal.aborted) return
    options.value = list
    for (const author of list) known.value.set(author.id, author.full_name)
  } catch {
    if (!current.signal.aborted) options.value = []
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 250)
})

function openList(): void {
  if (props.disabled) return
  open.value = true
  if (options.value.length === 0) void load()
}

function closeList(): void {
  open.value = false
  activeIndex.value = -1
}

function toggle(author: AuthorShort): void {
  known.value.set(author.id, author.full_name)
  model.value = model.value.includes(author.id)
    ? model.value.filter((id) => id !== author.id)
    : [...model.value, author.id]
}

function removeAuthor(id: number): void {
  model.value = model.value.filter((value) => value !== id)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeList()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) openList()
    const delta = event.key === 'ArrowDown' ? 1 : -1
    const count = options.value.length
    if (count > 0) activeIndex.value = (activeIndex.value + delta + count) % count
    return
  }
  if (event.key === 'Enter') {
    const option = options.value[activeIndex.value]
    if (open.value && option) {
      event.preventDefault()
      toggle(option)
    }
    return
  }
  if (event.key === 'Backspace' && search.value === '' && model.value.length > 0) {
    model.value = model.value.slice(0, -1)
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) closeList()
}

document.addEventListener('mousedown', onDocumentClick)
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  if (debounceTimer) clearTimeout(debounceTimer)
  controller?.abort()
})

function onAuthorCreated(author: Author): void {
  known.value.set(author.id, author.full_name)
  if (!model.value.includes(author.id)) model.value = [...model.value, author.id]
  search.value = ''
  void load()
}
</script>

<template>
  <div ref="root" class="picker" :class="{ 'picker--invalid': !!error }">
    <label class="picker__label" :for="rootId">
      Авторы
      <span class="picker__required" aria-hidden="true">*</span>
    </label>

    <div class="picker__anchor">
      <div class="picker__control" :class="{ 'is-open': open, 'is-disabled': disabled }" @click="openList">
      <span v-for="author in selected" :key="author.id" class="chip">
        {{ author.full_name }}
        <button
          class="chip__remove"
          type="button"
          :aria-label="`Убрать ${author.full_name}`"
          :disabled="disabled"
          @click.stop="removeAuthor(author.id)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </span>

      <input
        :id="rootId"
        v-model="search"
        class="picker__input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-invalid="!!error || undefined"
        :placeholder="selected.length ? '' : 'Начните вводить ФИО'"
        :disabled="disabled"
        autocomplete="off"
        @focus="openList"
        @keydown="onKeydown"
        />
      </div>

      <Transition name="fade">
        <div v-if="open" class="picker__dropdown">
        <ul v-if="options.length" class="picker__list" role="listbox" aria-multiselectable="true">
          <li
            v-for="(author, index) in options"
            :key="author.id"
            class="picker__option"
            :class="{ 'is-active': index === activeIndex, 'is-selected': model.includes(author.id) }"
            role="option"
            :aria-selected="model.includes(author.id)"
            @mouseenter="activeIndex = index"
            @click.stop="toggle(author)"
          >
            <span class="picker__check" aria-hidden="true">
              <svg v-if="model.includes(author.id)" viewBox="0 0 16 16">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            {{ author.full_name }}
          </li>
        </ul>

        <p v-else-if="loading" class="picker__status">Загрузка…</p>
        <p v-else class="picker__status">Ничего не найдено</p>

          <button class="picker__create" type="button" @click.stop="createOpen = true">
            <span aria-hidden="true">+</span>
            Создать автора{{ search.trim() ? ` «${search.trim()}»` : '' }}
          </button>
        </div>
      </Transition>
    </div>

    <p v-if="error" class="picker__error" role="alert">{{ error }}</p>
    <p v-else class="picker__hint">Можно выбрать несколько авторов</p>

    <AuthorFormModal
      :open="createOpen"
      :initial-name="search.trim()"
      @close="createOpen = false"
      @saved="onAuthorCreated"
    />
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.picker__anchor {
  position: relative;
}

.picker__label {
  font-size: var(--text-sm);
  font-weight: 560;
}

.picker__required {
  color: var(--danger);
  margin-left: 2px;
}

.picker__control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  cursor: text;
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}

.picker__control:hover:not(.is-disabled) {
  border-color: var(--text-faint);
}

.picker__control:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.picker__control.is-disabled {
  background: var(--bg-subtle);
  cursor: not-allowed;
}

.picker--invalid .picker__control {
  border-color: var(--danger);
}

.picker__input {
  flex: 1;
  min-width: 140px;
  height: 30px;
  padding: 0 var(--space-1);
  background: none;
  border: 0;
  font-size: var(--text-sm);
}

.picker__input:focus {
  outline: none;
  box-shadow: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px var(--space-1) 3px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 560;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: var(--radius-full);
}

.chip__remove {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.7;
}

.chip__remove:hover {
  opacity: 1;
  background: rgb(0 0 0 / 8%);
}

.chip__remove svg {
  width: 10px;
  height: 10px;
}

.picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.picker__list {
  list-style: none;
  margin: 0;
  padding: var(--space-1);
}

.picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.picker__option.is-active {
  background: var(--bg-subtle);
}

.picker__option.is-selected {
  color: var(--accent-text);
  font-weight: 560;
}

.picker__check {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
}

.picker__option.is-selected .picker__check {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.picker__check svg {
  width: 11px;
  height: 11px;
}

.picker__status {
  padding: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}

.picker__create {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  font-size: var(--text-sm);
  font-weight: 560;
  color: var(--accent-text);
  background: var(--bg-elevated);
  border: 0;
  border-top: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
}

.picker__create:hover {
  background: var(--accent-soft);
}

.picker__error {
  font-size: var(--text-xs);
  color: var(--danger-text);
}

.picker__hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
