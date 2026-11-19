<script setup lang="ts">
// Label the open message, or every ticked row: type to narrow the list,
// Enter to tick, and a name that doesn't exist yet becomes a new label
const { isOpen, messages } = useLabelPicker()
const { labels, has, toggle, create } = useLabels()

const query = ref('')
const index = ref(0)
watch(isOpen, (open) => {
  if (open) {
    query.value = ''
    index.value = 0
  }
})

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? labels.value.filter(label => label.name.toLowerCase().includes(q)) : labels.value
})
const canCreate = computed(() => {
  const q = query.value.trim()
  return !!q && !labels.value.some(label => label.name.toLowerCase() === q.toLowerCase())
})
const rows = computed(() => shown.value.length + (canCreate.value ? 1 : 0))
watch(rows, count => (index.value = Math.min(index.value, Math.max(0, count - 1))))

const state = (id: string) => {
  const on = messages.value.filter(message => has(message, id)).length
  return on === 0 ? 'false' : on === messages.value.length ? 'true' : 'mixed'
}

function choose(at = index.value) {
  const label = shown.value[at]
  if (label) return toggle(messages.value, label.id)
  if (!canCreate.value) return
  const made = create(query.value)
  if (made) toggle(messages.value, made.id)
  query.value = ''
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') index.value = (index.value + 1) % Math.max(1, rows.value)
  else if (event.key === 'ArrowUp') index.value = (index.value - 1 + Math.max(1, rows.value)) % Math.max(1, rows.value)
  else if (event.key === 'Enter') choose()
  else return
  event.preventDefault()
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Labels"
    :description="messages.length > 1 ? `For ${messages.length} conversations. Labels are kept on this computer.` : 'Labels are kept on this computer.'"
    :ui="{ content: 'sm:max-w-sm', body: 'p-2!' }"
  >
    <template #body>
      <UInput
        v-model="query"
        icon="i-lucide-tag"
        placeholder="Find or make a label"
        aria-label="Find or make a label"
        role="combobox"
        aria-controls="label-picker-list"
        :aria-expanded="true"
        :aria-activedescendant="rows ? `label-picker-${index}` : undefined"
        autofocus
        variant="none"
        class="w-full"
        @keydown="onKey"
      />
      <ul
        id="label-picker-list"
        role="listbox"
        aria-label="Labels"
        aria-multiselectable="true"
        class="mt-1 max-h-72 overflow-y-auto flex flex-col"
      >
        <li
          v-for="(label, at) in shown"
          :id="`label-picker-${at}`"
          :key="label.id"
          role="option"
          :aria-selected="state(label.id) === 'true'"
          class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors duration-(--lb-dur-1)"
          :class="at === index ? 'bg-elevated text-highlighted' : 'text-default'"
          @mousemove="index = at"
          @click="choose(at)"
        >
          <span
            class="size-2.5 rounded-full shrink-0"
            :style="{ background: labelVar(label.color) }"
            aria-hidden="true"
          />
          <span class="flex-1 truncate">{{ label.name }}</span>
          <UIcon
            v-if="state(label.id) !== 'false'"
            :name="state(label.id) === 'true' ? 'i-lucide-check' : 'i-lucide-minus'"
            class="size-4 text-primary"
            :aria-label="state(label.id) === 'true' ? 'On' : 'On some'"
          />
        </li>
        <li
          v-if="canCreate"
          :id="`label-picker-${shown.length}`"
          role="option"
          :aria-selected="false"
          class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer"
          :class="index === shown.length ? 'bg-elevated text-highlighted' : 'text-default'"
          @mousemove="index = shown.length"
          @click="choose(shown.length)"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-4 text-muted"
          />
          <span class="truncate">Make “{{ query.trim() }}”</span>
        </li>
        <li
          v-if="!rows"
          class="px-2.5 py-3 text-sm text-muted"
        >
          No labels yet. Type a name and press Enter to make the first.
        </li>
      </ul>
    </template>
  </UModal>
</template>
