<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

// The palette itself. What it lists comes from every feature that registered
// commands with `useCommands`, so nothing is named here. The one exception:
// what's typed can itself be a request ("archive everything from GitHub last
// week"), offered to the AI at the top
const { isOpen, groups } = useCommandPalette()
const commands = useAiCommands()

const searchTerm = ref('')
watch(isOpen, open => !open && (searchTerm.value = ''))

const labels = computed(() => groups.value.flatMap(group => (group.items ?? []).map(item => String(item.label ?? ''))))
const request = computed(() => commands.available.value ? commandRequest(searchTerm.value, labels.value) : undefined)

const shown = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const wanted = request.value
  if (!wanted) return groups.value
  return [{
    id: 'ai-command',
    label: 'AI',
    // It is the typed text itself, so the search must not filter it away
    ignoreFilter: true,
    items: [{
      label: 'Ask AI to do this',
      suffix: wanted,
      icon: 'i-lucide-sparkles',
      ui: { itemLeadingIcon: 'text-(--lb-ai)' },
      onSelect: () => {
        isOpen.value = false
        // After the palette has let go of focus, so the confirmation sheet can take it
        nextTick(() => commands.start(wanted))
      }
    }]
  }, ...groups.value]
})
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
        v-model:search-term="searchTerm"
        :groups="shown"
        :placeholder="commands.available.value ? 'Search, or say what to do (start with > to ask AI)' : 'Search for a folder, a person or something to do'"
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
