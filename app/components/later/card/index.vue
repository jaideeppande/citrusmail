<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { LaterCard } from '~/composables/useLaterBoard'

// One card on the Later board. Dragged between columns with the pointer, or
// moved with Alt and the arrow keys, or from its menu
const props = defineProps<{
  card: LaterCard
}>()

const board = useLaterBoard()

const editing = ref(false)
const note = ref('')
function editNote() {
  note.value = props.card.note ?? ''
  editing.value = true
}
function saveNote() {
  board.setNote(props.card.key, note.value)
  editing.value = false
}

const path = computed(() => ({ path: folderLink(props.card.message.folder), query: { m: props.card.message.id } }))
const at = computed(() => LATER_COLUMNS.findIndex(column => column.id === props.card.column))

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Open message', icon: 'i-lucide-mail-open', to: path.value },
  { label: props.card.note ? 'Edit note' : 'Add a note', icon: 'i-lucide-notebook-pen', onSelect: editNote }
], LATER_COLUMNS.filter(column => column.id !== props.card.column).map(column => ({
  label: `Move to ${column.label}`,
  icon: column.icon,
  onSelect: () => board.move(props.card.key, column.id)
})), [
  { label: 'Remove from the board', icon: 'i-lucide-x', onSelect: () => board.remove(props.card.key) }
]])

function onKey(event: KeyboardEvent) {
  if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
  const next = LATER_COLUMNS[at.value + (event.key === 'ArrowRight' ? 1 : -1)]
  if (!next) return
  event.preventDefault()
  board.move(props.card.key, next.id)
  // The card is redrawn in its new column: keep the keyboard on it
  nextTick(() => document.querySelector<HTMLElement>(`[data-later-card="${CSS.escape(props.card.key)}"] a`)?.focus())
}

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData(LATER_DRAG_TYPE, props.card.key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <li
    :data-later-card="card.key"
    class="group relative rounded-lg bg-default ring ring-default transition-shadow duration-(--lb-dur-1) hover:shadow-sm focus-within:ring-primary/60"
    draggable="true"
    @dragstart="onDragStart"
    @keydown="onKey"
  >
    <NuxtLink
      :to="path"
      class="block px-3 pt-2.5 pb-2 rounded-lg outline-none"
      :aria-label="`${card.message.subject || '(No subject)'}, from ${personName(card.message.from)}. Alt and the arrow keys move it between columns`"
    >
      <span class="flex items-center gap-2">
        <SenderAvatar
          :address="card.message.from"
          size="2xs"
        />
        <span class="flex-1 min-w-0 truncate text-xs text-muted">{{ personName(card.message.from) }}</span>
        <span class="shrink-0 text-xs text-muted tabular-nums">{{ listDate(card.message.date) }}</span>
      </span>
      <span class="block mt-1.5 text-sm font-medium text-highlighted line-clamp-2 text-pretty pe-5">{{ card.message.subject || '(No subject)' }}</span>
      <span class="block mt-0.5 text-xs text-muted line-clamp-2">{{ card.message.preview }}</span>
      <MailLabelChips
        :message="card.message"
        class="mt-1.5"
      />
    </NuxtLink>

    <form
      v-if="editing"
      class="px-3 pb-2.5"
      @submit.prevent="saveNote"
    >
      <UInput
        v-model="note"
        size="sm"
        maxlength="200"
        placeholder="A note to yourself"
        aria-label="Note"
        autofocus
        @blur="saveNote"
        @keydown.escape.stop="editing = false"
      />
    </form>
    <p
      v-else-if="card.note"
      class="mx-3 mb-2.5 ps-2 border-s-2 border-primary/50 text-xs text-toned"
    >
      {{ card.note }}
    </p>

    <UDropdownMenu
      :items="menu"
      :content="{ align: 'end' }"
    >
      <UButton
        icon="i-lucide-ellipsis"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Card options"
        class="absolute top-7 end-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 transition-opacity"
      />
    </UDropdownMenu>
  </li>
</template>
