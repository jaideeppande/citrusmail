<script setup lang="ts">
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_PARTS, ILLUSTRATION_WIDTH } from '~/utils/illustrations'
import type { IllustrationName, IllustrationTone } from '~/utils/illustrations'

// One of the app's line illustrations. Decorative only: the words next to it
// say what it means, so it is hidden from screen readers. Colours come from
// the theme, so it follows every accent and dark mode. `--lb-ill-accent`
// (set by <AppEmpty tone="error">) recolours the one accent detail
const props = defineProps<{
  name: IllustrationName
}>()

const LINE = 'var(--ui-text-dimmed)'
const FILL = 'var(--ui-bg-elevated)'
const ACCENT = 'var(--lb-ill-accent, var(--ui-primary))'

// Inline styles rather than presentation attributes: those don't take var()
const PAINT: Record<IllustrationTone, { fill: string, stroke: string }> = {
  'line': { fill: 'none', stroke: LINE },
  'soft': { fill: FILL, stroke: LINE },
  'wash': { fill: FILL, stroke: 'none' },
  'accent': { fill: 'none', stroke: ACCENT },
  'accent-soft': { fill: FILL, stroke: ACCENT },
  'dot': { fill: ACCENT, stroke: 'none' }
}

const parts = computed(() => ILLUSTRATION_PARTS[props.name] ?? [])
</script>

<template>
  <svg
    :viewBox="`0 0 ${ILLUSTRATION_WIDTH} ${ILLUSTRATION_HEIGHT}`"
    fill="none"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    :data-illustration="name"
  >
    <g
      v-for="(part, index) in parts"
      :key="index"
      :data-lb-motion="part.motion"
    >
      <path
        v-for="(shape, shapeIndex) in part.shapes"
        :key="shapeIndex"
        :d="shape.d"
        :style="PAINT[shape.tone]"
        :path-length="part.motion === 'draw' ? 1 : undefined"
      />
    </g>
  </svg>
</template>
