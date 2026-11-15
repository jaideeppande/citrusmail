<script setup lang="ts">
// The bar that stands over the grid while finding a time: how many slots are
// marked, and what to do with them. Focus moves into it as the mode starts,
// so a keyboard user lands on its controls, and back where it was on the way out
const { active, count, insert, copy, clear, stop } = useFindTime()
const { second } = useCalendarZones()

const bar = useTemplateRef('bar')
let origin: HTMLElement | null = null

watch(active, async (isActive) => {
  if (isActive) {
    origin = document.activeElement as HTMLElement | null
    await nextTick()
    bar.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
  } else if (origin?.isConnected) {
    origin.focus()
    origin = null
  }
})
</script>

<template>
  <Transition name="lb-rise">
    <div
      v-if="active"
      ref="bar"
      role="toolbar"
      aria-label="Find a time"
      class="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] start-1/2 z-40 flex items-center gap-1 -translate-x-1/2 rounded-lg bg-default p-1.5 ps-3 shadow-(--lb-shadow) ring ring-default"
    >
      <span
        class="me-2 text-sm whitespace-nowrap"
        role="status"
      >
        <span class="font-medium text-highlighted">{{ count ? freeSlotCount(count) : 'Mark free slots on the grid' }}</span>
        <span
          v-if="second"
          class="text-muted"
        > · with {{ calZoneCode(second) }}</span>
      </span>

      <UButton
        label="Insert into a message"
        icon="i-lucide-mail-plus"
        size="sm"
        :disabled="!count"
        @click="insert"
      />
      <UButton
        label="Copy as text"
        icon="i-lucide-copy"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!count"
        @click="copy"
      />
      <UButton
        label="Clear"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!count"
        @click="clear"
      />
      <UTooltip
        text="Done"
        :kbds="['escape']"
      >
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Stop finding a time"
          @click="stop"
        />
      </UTooltip>
    </div>
  </Transition>
</template>
