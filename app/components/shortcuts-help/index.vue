<script setup lang="ts">
import type { ShortcutId } from '~/utils/shortcuts'

const { isOpen } = useShortcutsHelp()
const { keysOf } = useShortcutKeys()

// The registry, grouped as it is written; each row shows the keys in use now
const groups = computed(() => {
  const byGroup = new Map<string, { id: ShortcutId, label: string, keys: string[] }[]>()
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const { group, label } = SHORTCUTS[id]
    const first = keysOf(id)[0]
    if (!first) continue
    byGroup.set(group, [...(byGroup.get(group) ?? []), { id, label, keys: shortcutParts(first) }])
  }
  return [...byGroup].map(([title, items]) => ({ title, items }))
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Keyboard shortcuts"
    description="Change any of them in Settings → Shortcuts."
    :ui="{ content: 'sm:max-w-3xl', body: 'columns-1 sm:columns-2 gap-8' }"
  >
    <template #body>
      <section
        v-for="group in groups"
        :key="group.title"
        class="break-inside-avoid mb-6"
      >
        <h3 class="text-sm font-semibold text-highlighted mb-2">
          {{ group.title }}
        </h3>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="flex items-center justify-between gap-4 text-sm text-muted"
          >
            <span>{{ item.label }}</span>
            <span class="flex items-center gap-0.5">
              <UKbd
                v-for="key in item.keys"
                :key="key"
                :value="key"
                variant="soft"
              />
            </span>
          </li>
        </ul>
      </section>
    </template>
  </UModal>
</template>
