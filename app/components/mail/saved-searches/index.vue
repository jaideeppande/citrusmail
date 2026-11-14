<script setup lang="ts">
// Saved searches in the sidebar, under the folders
defineProps<{
  collapsed?: boolean
}>()

const { saved, current, apply, remove, describe } = useSavedSearches()
</script>

<template>
  <section
    v-if="saved.length"
    class="flex flex-col gap-0.5"
  >
    <p
      v-if="!collapsed"
      class="px-2.5 pb-1 text-xs font-medium text-muted"
    >
      Saved searches
    </p>
    <TransitionGroup
      name="lb-list"
      tag="ul"
      class="relative flex flex-col gap-0.5"
    >
      <li
        v-for="item in saved"
        :key="item.id"
        class="group relative"
      >
        <UTooltip
          :text="collapsed ? item.name : describe(item)"
          :content="{ side: 'right' }"
        >
          <UButton
            :label="collapsed ? undefined : item.name"
            icon="i-lucide-bookmark"
            color="neutral"
            :variant="current?.id === item.id ? 'soft' : 'ghost'"
            size="sm"
            :square="collapsed"
            :aria-label="item.name"
            class="w-full justify-start gap-2 px-2.5 font-medium"
            :class="[current?.id === item.id ? 'text-highlighted' : 'text-muted hover:text-highlighted', collapsed && 'justify-center px-0']"
            :ui="{ label: 'truncate pe-5' }"
            @click="apply(item)"
          />
        </UTooltip>
        <UButton
          v-if="!collapsed"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          :aria-label="`Remove ${item.name}`"
          class="absolute end-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-dimmed"
          @click="remove(item.id)"
        />
      </li>
    </TransitionGroup>
  </section>
</template>
