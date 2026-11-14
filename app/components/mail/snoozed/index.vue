<script setup lang="ts">
// What's snoozed, and when each comes back. Snoozed mail is out of the list
// but still in its folder, so this is the one place to find it early
defineProps<{
  collapsed?: boolean
}>()

const { snoozed, wake } = useMailMarks()
const open = ref(false)

function show(item: { message: MessageSummary, key: string }) {
  wake([item.key])
  open.value = false
  navigateTo({ path: folderLink(item.message.folder), query: { m: item.message.id } })
}
</script>

<template>
  <UPopover
    v-if="snoozed.length"
    v-model:open="open"
    :content="{ side: 'right', align: 'end', sideOffset: 8 }"
    :ui="{ content: 'w-80 p-1.5' }"
  >
    <UButton
      :label="collapsed ? undefined : 'Snoozed'"
      icon="i-lucide-alarm-clock"
      color="neutral"
      variant="ghost"
      size="sm"
      :square="collapsed"
      aria-label="Snoozed"
      class="w-full justify-start gap-2 px-2.5 font-medium text-muted hover:text-highlighted"
      :class="collapsed && 'justify-center px-0'"
    >
      <template
        v-if="!collapsed"
        #trailing
      >
        <UBadge
          :label="String(snoozed.length)"
          color="neutral"
          variant="subtle"
          size="sm"
          class="ms-auto font-semibold tabular-nums"
        />
      </template>
    </UButton>

    <template #content>
      <p class="px-2 pt-1 pb-1.5 text-xs font-medium text-muted">
        Snoozed on this computer
      </p>
      <ul class="flex flex-col max-h-80 overflow-y-auto">
        <li
          v-for="(item, index) in snoozed"
          :key="item.key"
          class="group flex items-center gap-1 lb-stagger"
          :style="{ '--lb-i': index }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            class="flex-1 min-w-0 flex-col items-start gap-0 px-2 py-1.5 font-normal"
            @click="show(item)"
          >
            <span class="w-full truncate text-sm font-medium text-highlighted text-start">{{ item.message.subject || '(No subject)' }}</span>
            <span class="w-full truncate text-xs text-muted text-start">{{ personName(item.message.from) }} · back {{ snoozeLabel(item.until) }}</span>
          </UButton>
          <UTooltip text="Bring back now">
            <UButton
              icon="i-lucide-undo-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Bring back now"
              class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              @click="wake([item.key])"
            />
          </UTooltip>
        </li>
      </ul>
    </template>
  </UPopover>
</template>
