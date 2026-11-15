<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { folder, filter, total, status, load, refreshTop, ai, tabbed, checked, checkAll, shown, labelFilter } = useMail()
const { labels } = useLabels()
const activeLabel = computed(() => labels.value.find(label => label.id === labelFilter.value))
const { isSidebarOpen } = useShell()
const { kbds } = useShortcutKeys()
const gallery = useAttachmentGallery()
const triage = useTriage()

// When the list is narrow the filters shrink to icons, so nothing overlaps
const tabs = [
  { label: 'All', value: 'all', icon: 'i-lucide-mails' },
  { label: 'Unread', value: 'unread', icon: 'i-lucide-mail-open' },
  { label: 'Flagged', value: 'flagged', icon: 'i-lucide-flag' }
]

// What acts on the folder as a whole, behind one button: the header has no room for more
const more = computed<DropdownMenuItem[][]>(() => [[{
  label: checked.value.size ? 'Deselect all' : 'Select all',
  icon: checked.value.size ? 'i-lucide-square-check-big' : 'i-lucide-square',
  kbds: kbds('mail.selectAll'),
  disabled: !shown.value.length,
  onSelect: checkAll
}, {
  label: 'Triage one at a time',
  icon: 'i-lucide-list-checks',
  kbds: kbds('mail.triage'),
  onSelect: () => triage.start()
}], [{
  label: 'Attachments in this folder',
  icon: 'i-lucide-paperclip',
  onSelect: () => gallery.open()
}]])

const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await Promise.all([refreshTop(), new Promise(resolve => setTimeout(resolve, 400))])
  refreshing.value = false
}
</script>

<template>
  <section class="@container relative flex flex-col min-h-0 h-full">
    <header class="shrink-0 flex items-center gap-1 @sm:gap-2 h-14 ps-4 pe-3 border-b border-default">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="lg:hidden shrink-0 -ms-1.5"
        @click="isSidebarOpen = true"
      />

      <h1 class="flex-1 min-w-0 flex items-baseline gap-2">
        <span class="text-lg font-bold tracking-tight text-highlighted truncate">{{ folder?.name ?? 'Inbox' }}</span>
        <span
          v-if="status !== 'loading' && total"
          class="shrink-0 text-sm text-muted tabular-nums @max-[24rem]:hidden"
        >{{ total.toLocaleString() }}</span>
      </h1>

      <UDropdownMenu
        :items="more"
        :content="{ align: 'end' }"
        :ui="{ content: 'min-w-60' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="More for this folder"
        />
      </UDropdownMenu>

      <UTooltip text="Check for new mail">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Check for new mail"
          :ui="{ leadingIcon: refreshing || status === 'refreshing' ? 'animate-spin' : '' }"
          @click="refresh"
        />
      </UTooltip>

      <MailViewToggle />

      <UTabs
        v-model="filter"
        :items="tabs"
        :content="false"
        color="neutral"
        size="xs"
        class="shrink-0 w-auto"
        :ui="{ trigger: 'px-2 @max-[30rem]:px-1.5', label: '@max-[30rem]:sr-only', leadingIcon: 'size-3.5 @min-[30rem]:hidden' }"
      />
    </header>

    <MailSearchBar />

    <MailInboxTabs v-if="tabbed && !ai.on" />

    <Transition name="lb-collapse">
      <div v-if="activeLabel && !ai.on">
        <div class="flex items-center gap-2 px-4 h-9 border-b border-default text-sm">
          <span
            class="size-2.5 rounded-full"
            :style="{ background: labelVar(activeLabel.color) }"
            aria-hidden="true"
          />
          <span class="flex-1 truncate text-toned">Labelled <span class="font-medium text-highlighted">{{ activeLabel.name }}</span></span>
          <UButton
            label="Show all"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="labelFilter = undefined"
          />
        </div>
      </div>
    </Transition>

    <MailScheduledSection v-if="folder?.role === 'drafts' && !ai.on" />

    <MailAiResults v-if="ai.on" />

    <MailList v-else-if="status !== 'error'" />

    <UEmpty
      v-else
      icon="i-lucide-wifi-off"
      title="Couldn’t load this folder"
      description="The mail server didn’t answer. It may be busy, or your connection dropped."
      :actions="[{ label: 'Try again', icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'outline', onClick: () => load() }]"
      variant="naked"
      class="flex-1"
    />
  </section>
</template>
