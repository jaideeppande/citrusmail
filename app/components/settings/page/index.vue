<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
  /** Room for something wider than a column of fields, like the theme editor */
  wide?: boolean
  /** A way back, for a page that opens from another tab */
  back?: { label: string, to: string }
}>()

const { isSidebarOpen } = useShell()
const route = useRoute()

// Moving to another tab puts the keyboard and the screen reader at the top
// of the new one, so it's read from its heading instead of from wherever the
// sidebar link was
const heading = useTemplateRef<HTMLElement>('heading')
const scroller = useTemplateRef<HTMLElement>('scroller')
watch(() => route.path, async (path, before) => {
  if (!before || path === before) return
  await nextTick()
  scroller.value?.scrollTo({ top: 0 })
  heading.value?.focus({ preventScroll: true })
})
</script>

<template>
  <section
    class="flex min-w-0 flex-1 flex-col"
    aria-labelledby="settings-title"
  >
    <header class="flex h-14 shrink-0 items-center gap-2 border-b border-default px-4">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="-ms-1.5 shrink-0 lg:hidden"
        @click="isSidebarOpen = true"
      />
      <UButton
        v-if="props.back"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="props.back.to"
        :aria-label="`Back to ${props.back.label}`"
        class="-ms-1.5 shrink-0"
      />
      <h1
        id="settings-title"
        ref="heading"
        tabindex="-1"
        class="text-base font-semibold tracking-tight text-highlighted outline-none"
      >
        {{ title }}
      </h1>
      <span class="flex-1" />
      <slot name="actions" />
    </header>

    <div
      ref="scroller"
      class="flex-1 overflow-y-auto"
    >
      <div
        class="px-5 py-7 sm:px-8"
        :class="wide ? 'max-w-5xl' : 'max-w-2xl'"
      >
        <p class="mb-8 text-sm text-muted">
          {{ description }}
        </p>
        <slot />
      </div>
    </div>
  </section>
</template>
