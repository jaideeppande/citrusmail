<script setup lang="ts">
const { listed, messages, status, cursor, load, folder, search, filter, filtering, selectedId, isRowSelected, inboxTabs, tabbed } = useMail()
const { view } = useMailLayout()
const { isMobile } = useShell()
const prefs = usePrefs()
// The list-only view packs a message into one line
const compact = computed(() => view.value === 'list' && !isMobile.value)

const scroller = useTemplateRef('scroller')
const scrollEl = computed(() => scroller.value?.$el as HTMLElement | undefined)
usePrefetchOnHover(scrollEl)

useInfiniteScroll(scrollEl, () => load(false), {
  distance: 600,
  canLoadMore: () => !!cursor.value && status.value === 'idle'
})

// Keep the selected row in view as j/k walks past the edge
watch(selectedId, (id) => {
  if (!id) return
  nextTick(() => scrollEl.value?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }))
})

const tab = computed(() => tabbed.value ? inboxTabs.value?.tab.value : undefined)
const rowHeight = computed(() => DENSITY_ROWS[prefs.value.density][compact.value ? 'compact' : 'roomy'])

const empty = computed(() => {
  if (filtering.value) return { icon: 'i-lucide-search-x', title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches${search.value ? ` “${search.value}”` : ''} with these filters.` }
  if (filter.value === 'flagged') return { icon: 'i-lucide-flag', title: 'Nothing flagged', description: 'Press S on a message to flag it for later.' }
  if (search.value) return { icon: 'i-lucide-search-x', title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches “${search.value}”.` }
  if (filter.value === 'unread') return { icon: 'i-lucide-check-check', title: 'All read', description: 'You’re caught up.' }
  if (tab.value === 'screen') return { icon: 'i-lucide-user-round-check', title: 'No one new', description: 'Mail from people who haven’t written to you before waits here until you allow or block them.' }
  if (tab.value === 'tracked') return { icon: 'i-lucide-mail-check', title: 'Nothing tracked', description: 'Messages you send with tracking on show here with what’s come back.' }
  if (tab.value === 'newsletters') return { icon: 'i-lucide-newspaper', title: 'No newsletters', description: 'Mail from the lists you’re on shows here.' }
  if (tab.value === 'notifications') return { icon: 'i-lucide-bell', title: 'No notifications', description: 'Receipts, alerts and other mail sent by machines shows here.' }
  // Everything dealt with is worth a moment
  if (folder.value?.role === 'inbox' && !messages.value.length) return { icon: 'i-lucide-sun', title: 'Inbox zero', description: 'Nothing left to deal with. New mail shows up here on its own.', zero: true }
  if (messages.value.length) return { icon: 'i-lucide-alarm-clock', title: 'Nothing here right now', description: 'What’s left in this folder is snoozed or under another tab.' }
  return { icon: folderIcon(folder.value), title: `${folder.value?.name ?? 'This folder'} is empty`, description: undefined }
})
</script>

<template>
  <div
    v-if="status === 'loading' && !messages.length"
    class="flex-1 flex flex-col"
  >
    <div
      v-for="n in 8"
      :key="n"
      class="flex gap-3 ps-6 pe-4 py-3.5 border-b border-default lb-stagger"
      :style="{ '--lb-i': n - 1 }"
    >
      <USkeleton class="size-8 rounded-full shrink-0" />
      <div class="flex-1 flex flex-col gap-2">
        <USkeleton class="h-3.5 w-2/5" />
        <USkeleton class="h-3.5 w-4/5" />
        <USkeleton class="h-3 w-11/12" />
      </div>
    </div>
  </div>

  <UEmpty
    v-else-if="!listed.length"
    :icon="empty.icon"
    :title="empty.title"
    :description="empty.description"
    variant="naked"
    class="flex-1 lb-in-up"
    :class="empty.zero && 'lb-inbox-zero'"
  />

  <UScrollArea
    v-else
    ref="scroller"
    :key="`${compact ? 'compact' : 'roomy'}:${prefs.density}`"
    data-tour="list"
    :items="listed"
    :virtualize="{ estimateSize: rowHeight, overscan: 8 }"
    class="flex-1 transition-opacity duration-(--lb-dur-2)"
    :class="status === 'loading' && 'opacity-60'"
    :ui="{ viewport: 'pb-16' }"
  >
    <template #default="{ item }">
      <MailListItemCompact
        v-if="compact"
        :message="item as MessageSummary"
        :selected="isRowSelected(item as MessageSummary)"
        :sent="folder?.role === 'sent' || folder?.role === 'drafts' || tab === 'tracked'"
        :screen="tab === 'screen'"
      />
      <MailListItem
        v-else
        :message="item as MessageSummary"
        :selected="isRowSelected(item as MessageSummary)"
        :sent="folder?.role === 'sent' || folder?.role === 'drafts' || tab === 'tracked'"
        :screen="tab === 'screen'"
      />
    </template>
  </UScrollArea>

  <MailBulkBar />

  <Transition name="lb-fade">
    <div
      v-if="status === 'more'"
      class="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none"
    >
      <UBadge
        icon="i-lucide-loader-circle"
        label="Loading more"
        color="neutral"
        variant="soft"
        class="rounded-full ring ring-default bg-default"
        :ui="{ leadingIcon: 'animate-spin' }"
      />
    </div>
  </Transition>
</template>
