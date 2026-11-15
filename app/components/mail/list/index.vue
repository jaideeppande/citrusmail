<script setup lang="ts">
const { listed, messages, status, cursor, load, folder, search, filter, filtering, selectedId, isRowSelected, inboxTabs, tabbed, labelFilter } = useMail()
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
  if (filtering.value) return { illustration: 'no-results' as const, title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches${search.value ? ` “${search.value}”` : ''} with these filters.` }
  if (filter.value === 'flagged') return { illustration: 'empty-folder' as const, title: 'Nothing flagged', description: 'Press S on a message to flag it for later.' }
  if (search.value) return { illustration: 'no-results' as const, title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches “${search.value}”.` }
  if (labelFilter.value) return { illustration: 'no-results' as const, title: 'Nothing with this label here', description: `No message in ${folder.value?.name ?? 'this folder'} carries it. Labels follow a message to other folders.` }
  if (filter.value === 'unread') return { illustration: 'all-read' as const, title: 'All read', description: 'You’re caught up.' }
  if (tab.value === 'screen') return { illustration: 'screen' as const, title: 'No one new', description: 'Mail from people who haven’t written to you before waits here until you allow or block them.' }
  if (tab.value === 'tracked') return { illustration: 'no-subscriptions' as const, title: 'Nothing tracked', description: 'Messages you send with tracking on show here with what’s come back.' }
  if (tab.value === 'newsletters') return { illustration: 'no-subscriptions' as const, title: 'No newsletters', description: 'Mail from the lists you’re on shows here.' }
  if (tab.value === 'notifications') return { illustration: 'no-notifications' as const, title: 'No notifications', description: 'Receipts, alerts and other mail sent by machines shows here.' }
  // Everything dealt with is worth a moment
  if (folder.value?.role === 'inbox' && !messages.value.length) return { illustration: 'inbox-zero' as const, title: 'Inbox zero', description: 'Nothing left to deal with. New mail shows up here on its own.' }
  if (messages.value.length) return { illustration: 'snoozed' as const, title: 'Nothing here right now', description: 'What’s left in this folder is snoozed or under another tab.' }
  return { illustration: folder.value?.role === 'drafts' ? 'no-drafts' as const : 'empty-folder' as const, title: `${folder.value?.name ?? 'This folder'} is empty`, description: undefined }
})
</script>

<template>
  <SkeletonMessageRow
    v-if="status === 'loading' && !messages.length"
    :compact="compact"
    class="flex-1"
  />

  <AppEmpty
    v-else-if="!listed.length"
    :illustration="empty.illustration"
    :title="empty.title"
    :description="empty.description"
    :size="compact ? 'md' : 'sm'"
    class="flex-1"
  />

  <UScrollArea
    v-else
    ref="scroller"
    :key="`${compact ? 'compact' : 'roomy'}:${prefs.density}`"
    data-tour="list"
    role="region"
    :aria-label="`Messages in ${folder?.name ?? 'this folder'}`"
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
