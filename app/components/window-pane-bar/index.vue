<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// The slim header of a pane in a split layout: what it shows, with a menu to
// show something else, and the buttons to pop it out or close it. A pane has
// no sidebar, so this menu is how it gets from one place to another
const { section, account } = useShell()
const { folders, folder } = useMail()
const route = useRoute()
const index = paneIndex()

const title = computed(() => {
  if (section.value === 'calendar') return 'Calendar'
  if (section.value === 'contacts') return 'Contacts'
  if (section.value === 'settings') return 'Settings'
  return route.path.startsWith('/subscriptions') ? 'Subscriptions' : folder.value?.name ?? 'Mail'
})
const icon = computed(() => {
  if (section.value === 'calendar') return 'i-lucide-calendar'
  if (section.value === 'contacts') return 'i-lucide-book-user'
  if (section.value === 'settings') return 'i-lucide-settings'
  return folderIcon(folder.value)
})

const items = computed<DropdownMenuItem[][]>(() => [
  folders.value.map(item => ({
    label: item.name,
    icon: folderIcon(item),
    to: folderLink(item.path),
    class: ['', 'ps-5', 'ps-8', 'ps-11'][Math.min(item.depth, 3)]
  })),
  [
    ...(account.value?.hasCalendar ? [{ label: 'Calendar', icon: 'i-lucide-calendar', to: `/calendar/week/${todayDate().toString()}` }] : []),
    ...(account.value?.hasContacts ? [{ label: 'Contacts', icon: 'i-lucide-book-user', to: '/contacts' }] : [])
  ]
].filter(group => group.length))

// The window this pane sits in remembers where each pane was left
watch(() => route.fullPath, path => tellWindows({ type: 'pane:route', index, path }), { immediate: true })
</script>

<template>
  <header class="shrink-0 flex items-center gap-1 h-9 ps-2 pe-1.5 border-b border-default bg-elevated/40">
    <UDropdownMenu
      :items="items"
      :content="{ align: 'start' }"
      :ui="{ content: 'min-w-56 max-h-96' }"
    >
      <UButton
        :label="title"
        :icon="icon"
        trailing-icon="i-lucide-chevron-down"
        color="neutral"
        variant="ghost"
        size="xs"
        class="font-medium text-toned"
        :ui="{ trailingIcon: 'size-3.5 text-dimmed' }"
      />
    </UDropdownMenu>

    <div class="ms-auto flex items-center">
      <UTooltip text="Open in a new window">
        <UButton
          icon="i-lucide-picture-in-picture-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Open in a new window"
          class="text-dimmed hover:text-highlighted"
          @click="tellWindows({ type: 'pane:popout', index, path: currentPath() })"
        />
      </UTooltip>
      <UTooltip text="Close pane">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Close pane"
          class="text-dimmed hover:text-highlighted"
          @click="tellWindows({ type: 'pane:close', index })"
        />
      </UTooltip>
    </div>
  </header>
</template>
