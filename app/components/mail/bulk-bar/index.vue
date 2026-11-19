<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// What rises from the bottom of the list while rows are ticked: how many,
// and everything that can be done to all of them at once
const { checked, checkedRows, clearChecked, checkAll, shown, moveMany, removeMany, setUnreadMany, flagMany, folder, folders, threadInfo } = useMail()
const { kbds } = useShortcutKeys()
const tasks = useAiTasks()
const suggested = useAiLabels()
const priority = useAiPriority()

const suggestedRows = computed(() => suggested.withSuggestions(checkedRows.value))

const count = computed(() => checkedRows.value.length)
const anyUnread = computed(() => checkedRows.value.some(message => threadInfo(message)?.unread ?? message.unread))
const allFlagged = computed(() => checkedRows.value.every(message => message.flagged))
// With "Needs you" on, "All" means the rows you can see
const visible = computed(() => priority.needsYou.value ? shown.value.filter(priority.needsYouRow) : shown.value)
const all = computed(() => count.value === visible.value.length)
function toggleAll() {
  if (!priority.needsYou.value) return checkAll()
  checked.value = all.value ? new Set() : new Set(visible.value.map(messageKey))
}

const targets = computed<DropdownMenuItem[][]>(() => [folders.value
  .filter(item => item.path !== folder.value?.path && item.role !== 'drafts' && item.role !== 'sent' && item.role !== 'flagged')
  .map(item => ({ label: item.name, icon: folderIcon(item), onSelect: () => moveMany(checkedRows.value, item.path) }))])

const snoozes = computed(() => [snoozeItems(() => checkedRows.value)])

const bar = useTemplateRef<HTMLElement>('bar')
useRovingFocus(bar)
</script>

<template>
  <Transition name="lb-rise">
    <div
      v-if="count"
      class="absolute bottom-4 inset-x-0 z-10 flex justify-center px-3 pointer-events-none"
    >
      <div
        ref="bar"
        role="toolbar"
        aria-label="Selected messages"
        class="pointer-events-auto flex items-center gap-0.5 ps-3 pe-1 py-1 rounded-full bg-inverted text-inverted shadow-lg ring ring-default/10 max-w-full"
      >
        <span class="text-sm font-medium tabular-nums whitespace-nowrap me-1">{{ count }} selected</span>

        <UTooltip
          v-if="folder?.role !== 'archive'"
          text="Archive"
          :kbds="kbds('mail.archive')"
        >
          <UButton
            icon="i-lucide-archive"
            variant="link"
            size="sm"
            aria-label="Archive"
            class="lb-bulk-action"
            @click="moveMany(checkedRows, 'archive')"
          />
        </UTooltip>
        <UTooltip
          text="Delete"
          :kbds="kbds('mail.delete').slice(0, 1)"
        >
          <UButton
            icon="i-lucide-trash-2"
            variant="link"
            size="sm"
            aria-label="Delete"
            class="lb-bulk-action"
            @click="removeMany(checkedRows)"
          />
        </UTooltip>
        <UDropdownMenu
          :items="targets"
          :content="{ side: 'top' }"
          :ui="{ content: 'min-w-52 max-h-80' }"
        >
          <UTooltip text="Move to a folder">
            <UButton
              icon="i-lucide-folder-input"
              variant="link"
              size="sm"
              aria-label="Move to a folder"
              class="lb-bulk-action"
            />
          </UTooltip>
        </UDropdownMenu>
        <UDropdownMenu
          :items="snoozes"
          :content="{ side: 'top' }"
          :ui="{ content: 'min-w-56' }"
        >
          <UTooltip text="Snooze">
            <UButton
              icon="i-lucide-alarm-clock"
              variant="link"
              size="sm"
              aria-label="Snooze"
              class="lb-bulk-action"
            />
          </UTooltip>
        </UDropdownMenu>
        <UTooltip
          :text="anyUnread ? 'Mark as read' : 'Mark as unread'"
          :kbds="kbds('mail.toggleRead')"
        >
          <UButton
            :icon="anyUnread ? 'i-lucide-mail-open' : 'i-lucide-mail'"
            variant="link"
            size="sm"
            :aria-label="anyUnread ? 'Mark as read' : 'Mark as unread'"
            class="lb-bulk-action"
            @click="setUnreadMany(checkedRows, !anyUnread)"
          />
        </UTooltip>
        <UTooltip
          :text="allFlagged ? 'Remove flags' : 'Flag'"
          :kbds="kbds('mail.flag')"
        >
          <UButton
            :icon="allFlagged ? 'i-ph-flag-fill' : 'i-lucide-flag'"
            variant="link"
            size="sm"
            :aria-label="allFlagged ? 'Remove flags' : 'Flag'"
            class="lb-bulk-action"
            @click="flagMany(checkedRows, !allFlagged)"
          />
        </UTooltip>

        <UTooltip
          v-if="tasks.on.value"
          text="Find tasks"
        >
          <UButton
            icon="i-lucide-list-todo"
            variant="link"
            size="sm"
            aria-label="Find tasks"
            class="lb-bulk-action"
            @click="tasks.extract(checkedRows)"
          />
        </UTooltip>
        <UTooltip
          v-if="suggestedRows.length"
          text="Apply suggested labels"
        >
          <UButton
            icon="i-lucide-sparkles"
            variant="link"
            size="sm"
            aria-label="Apply suggested labels"
            class="lb-bulk-action"
            @click="suggested.applyAll(suggestedRows)"
          />
        </UTooltip>

        <span class="w-px h-4 bg-current/20 mx-1" />

        <UButton
          :label="all ? 'None' : 'All'"
          variant="link"
          size="sm"
          class="lb-bulk-action"
          @click="toggleAll"
        />
        <UTooltip
          text="Clear selection"
          :kbds="['escape']"
        >
          <UButton
            icon="i-lucide-x"
            variant="link"
            size="sm"
            aria-label="Clear selection"
            class="lb-bulk-action"
            @click="clearChecked"
          />
        </UTooltip>
      </div>
    </div>
  </Transition>
</template>
