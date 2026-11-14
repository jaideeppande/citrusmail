<script setup lang="ts">
// The palette itself. What it lists comes from every feature that registered
// commands with `useCommands`, so nothing is named here
const { isOpen, groups } = useCommandPalette()
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Search and commands"
    description="Go anywhere, or do anything, by typing."
    :ui="{ content: 'sm:max-w-2xl lb-in-scale', header: 'sr-only' }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Search for a folder, a person or something to do"
        close
        class="h-full sm:h-112"
        :fuse="{ resultLimit: 40 }"
        @update:model-value="isOpen = false"
        @update:open="isOpen = false"
      >
        <!-- Where the palette puts its own selected mark, so a shown calendar
          reads the same as anything it ticks itself -->
        <template #calendar-trailing="{ item, ui }">
          <UIcon
            v-if="item.checked"
            name="i-lucide-check"
            :class="ui.itemTrailingIcon()"
          />
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
