<script setup lang="ts">
// One extra pane: the app again, in a frame named for its place in the
// layout. The name is how the page inside knows it is a pane, and which
const props = defineProps<{
  index: number
  path: string
}>()

// Only where it starts: the page inside navigates on its own from here, and
// a changed src would throw that away
const src = props.path
const loaded = ref(false)
</script>

<template>
  <div class="relative">
    <iframe
      :name="paneName(index)"
      :src="src"
      :title="`Pane ${index + 1}`"
      class="absolute inset-0 size-full border-0 transition-opacity duration-(--lb-dur-2)"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
    />
    <div
      v-if="!loaded"
      class="absolute inset-0 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 text-muted animate-spin"
      />
    </div>
  </div>
</template>
