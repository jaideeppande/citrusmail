<script setup lang="ts">
// A small bell with a line through it while do not disturb is on. A click
// turns it off. Shows nothing otherwise, so it can sit in any toolbar
const dnd = useDoNotDisturb()
</script>

<template>
  <Transition name="lb-pop">
    <span
      v-if="dnd.active.value"
      class="inline-flex"
    >
      <UTooltip :text="`Do not disturb · ${dnd.label.value.toLowerCase()}. Click to turn off`">
        <UButton
          icon="i-lucide-bell-off"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Turn off do not disturb"
          @click="dnd.clear()"
        />
      </UTooltip>
    </span>
  </Transition>
</template>
