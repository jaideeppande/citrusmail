<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

// A grid to choose a table's size: point at (or move with the arrow keys
// to) the bottom-right cell it should have, then click or press Enter
const props = defineProps<{
  editor: Editor
}>()

const MAX = 6
const { table: open } = useComposerTools()
const rows = ref(3)
const cols = ref(3)
const grid = useTemplateRef('grid')

watch(open, (value) => {
  if (!value) return
  rows.value = 3
  cols.value = 3
  nextTick(() => grid.value?.focus())
})

function onKey(event: KeyboardEvent) {
  const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  const move = moves[event.key]
  if (move) {
    event.preventDefault()
    rows.value = Math.min(MAX, Math.max(1, rows.value + move[0]))
    cols.value = Math.min(MAX, Math.max(1, cols.value + move[1]))
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    insert()
  }
}

function insert(r = rows.value, c = cols.value) {
  open.value = false
  // Once the pop-up has handed the cursor back to the editor
  setTimeout(() => {
    props.editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()
    announce(`Table inserted, ${r} by ${c}. Tab moves to the next cell.`)
  }, 0)
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'top', align: 'center' }"
    :ui="{ content: 'p-3' }"
  >
    <UTooltip text="Table">
      <UButton
        icon="i-lucide-table"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Insert table"
      />
    </UTooltip>

    <template #content>
      <div class="flex flex-col gap-2">
        <p
          id="lb-table-size"
          class="text-xs font-medium text-toned"
        >
          Table, {{ rows }} × {{ cols }}
        </p>
        <div
          ref="grid"
          role="slider"
          tabindex="0"
          aria-labelledby="lb-table-size"
          :aria-valuetext="`${rows} rows by ${cols} columns`"
          :aria-valuenow="rows * 10 + cols"
          aria-valuemin="11"
          aria-valuemax="66"
          class="lb-focus grid grid-cols-6 gap-1 rounded-md"
          @keydown="onKey"
        >
          <template
            v-for="r in MAX"
            :key="r"
          >
            <button
              v-for="c in MAX"
              :key="c"
              type="button"
              tabindex="-1"
              aria-hidden="true"
              class="size-5 rounded-sm ring ring-default transition-colors duration-(--lb-dur-1)"
              :class="r <= rows && c <= cols ? 'bg-primary/25 ring-primary' : 'bg-default hover:bg-elevated'"
              @mouseenter="rows = r; cols = c"
              @click="insert(r, c)"
            />
          </template>
        </div>
        <p class="text-xs text-muted">
          Arrow keys to size, Enter to insert
        </p>
      </div>
    </template>
  </UPopover>
</template>
