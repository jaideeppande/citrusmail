<script setup lang="ts">
// The window's panes. The first is the app itself (the slot); the others are
// frames of it. They sit in a 2 by 2 grid whose tracks close to nothing when
// a layout doesn't use them, so going from one layout to another is the same
// grid easing to new proportions rather than a new one appearing
const { active, layout, extras, split, setSplit } = usePanes()

// Which cell each pane takes, per layout: [column, row, column span, row span]
const spans = computed(() => layout.value.cells)
const cell = (index: number) => {
  const [column, row, columns, rows] = spans.value[index] ?? [0, 0, 2, 2]
  return { gridColumn: `${column + 1} / span ${columns}`, gridRow: `${row + 1} / span ${rows}` }
}

const twoColumns = computed(() => active.value && layout.value.id !== 'rows')
const twoRows = computed(() => active.value && layout.value.id !== 'columns')
const template = computed(() => ({
  gridTemplateColumns: twoColumns.value ? `${split.value[0]}fr ${1 - split.value[0]}fr` : '1fr 0fr',
  gridTemplateRows: twoRows.value ? `${split.value[1]}fr ${1 - split.value[1]}fr` : '1fr 0fr'
}))

// Dragging a divider. Frames swallow the pointer, so they stop taking it
// for as long as the drag lasts
const grid = useTemplateRef('grid')
const dragging = ref<0 | 1>()
function drag(axis: 0 | 1, event: PointerEvent) {
  const box = grid.value!.getBoundingClientRect()
  dragging.value = axis
  const move = (now: PointerEvent) => setSplit(axis, axis === 0 ? (now.clientX - box.left) / box.width : (now.clientY - box.top) / box.height)
  const stop = () => {
    dragging.value = undefined
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  event.preventDefault()
}

function nudge(axis: 0 | 1, event: KeyboardEvent) {
  const step = { ArrowLeft: -0.02, ArrowUp: -0.02, ArrowRight: 0.02, ArrowDown: 0.02 }[event.key]
  if (!step) return
  event.preventDefault()
  setSplit(axis, split.value[axis] + step)
}

// A frame keeps the page it was opened on; changing the layout starts them afresh
const generation = computed(() => `${layout.value.id}:${extras.value.length}`)
</script>

<template>
  <div
    ref="grid"
    class="lb-panes relative flex-1 min-h-0 min-w-0 grid"
    :data-split="active || undefined"
    :data-dragging="dragging !== undefined || undefined"
    :style="template"
  >
    <div
      class="lb-pane"
      :style="active ? cell(0) : { gridColumn: '1 / span 2', gridRow: '1 / span 2' }"
    >
      <slot />
    </div>

    <WindowPaneFrame
      v-for="pane in extras"
      :key="`${generation}:${pane.index}`"
      :index="pane.index"
      :path="pane.path"
      class="lb-pane lb-in-scale"
      :style="cell(pane.index)"
    />

    <template v-if="active">
      <div
        v-if="twoColumns"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        tabindex="0"
        class="lb-pane-divider"
        :style="{ left: `${split[0] * 100}%` }"
        @pointerdown="drag(0, $event)"
        @keydown="nudge(0, $event)"
        @dblclick="setSplit(0, 0.5)"
      />
      <div
        v-if="twoRows"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panes"
        tabindex="0"
        class="lb-pane-divider"
        :style="{ top: `${split[1] * 100}%`, left: layout.id === 'three' ? `${split[0] * 100}%` : '0' }"
        @pointerdown="drag(1, $event)"
        @keydown="nudge(1, $event)"
        @dblclick="setSplit(1, 0.5)"
      />
    </template>
  </div>
</template>
