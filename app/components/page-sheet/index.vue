<script setup lang="ts">
// A page of its own inside the sheet: a title bar and a scrolling column
defineProps<{
  title: string
  description?: string
}>()

const { isSidebarOpen } = useShell()
// The layout's <main> holds the sheet, so this is a region named by its
// title rather than a second main landmark
const headingId = useId()
</script>

<template>
  <section
    class="flex-1 min-w-0 flex flex-col"
    :aria-labelledby="headingId"
  >
    <header class="shrink-0 flex items-center gap-2 h-14 px-4 border-b border-default">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="lg:hidden shrink-0 -ms-1.5"
        @click="isSidebarOpen = true"
      />
      <h1
        :id="headingId"
        class="text-lg font-bold tracking-tight text-highlighted"
      >
        {{ title }}
      </h1>
      <div class="ms-auto flex items-center gap-1">
        <slot name="actions" />
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="max-w-3xl px-5 sm:px-8 py-5">
        <p
          v-if="description"
          class="text-sm text-muted mb-5 max-w-prose text-pretty"
        >
          {{ description }}
        </p>
        <slot />
      </div>
    </div>
  </section>
</template>
