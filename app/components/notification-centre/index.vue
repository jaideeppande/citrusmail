<script setup lang="ts">
import type { Notice } from '~/composables/useNotificationCentre'

// The bell in the window bar, and the list behind it
const centre = useNotificationCentre()
const { kbds } = useShortcutKeys()
const { account } = useShell()
const { switchTo } = useMailboxes()

// What's there when it opens counts as seen once it closes again
watch(centre.isOpen, (open, was) => {
  if (was && !open) centre.markRead()
})

function act(notice: Notice) {
  centre.markRead(notice.id)
  centre.isOpen.value = false
  if (!notice.to) return
  if (notice.mailbox && notice.mailbox !== account.value?.email.toLowerCase()) return switchTo(notice.mailbox, notice.to)
  navigateTo(notice.to)
}

const when = (at: number) => {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes} min`
  return listDate(new Date(at).toISOString())
}
</script>

<template>
  <UPopover
    v-model:open="centre.isOpen.value"
    :content="{ align: 'end', sideOffset: 8 }"
    :ui="{ content: 'w-88 flex flex-col max-h-[min(32rem,calc(100dvh-6rem))]' }"
  >
    <UTooltip
      text="Notifications"
      :kbds="kbds('app.notifications')"
    >
      <UButton
        icon="i-lucide-bell"
        color="neutral"
        :variant="centre.isOpen.value ? 'soft' : 'ghost'"
        size="xs"
        :aria-label="centre.unread.value ? `Notifications, ${centre.unread.value} new` : 'Notifications'"
        class="relative text-muted hover:text-highlighted"
      >
        <template #trailing>
          <Transition name="lb-pop">
            <span
              v-if="centre.unread.value"
              class="absolute top-0.5 end-0.5 size-2 rounded-full bg-primary ring-2 ring-(--lb-desk-solid)"
              aria-hidden="true"
            />
          </Transition>
        </template>
      </UButton>
    </UTooltip>

    <template #content>
      <header class="shrink-0 flex items-center gap-2 ps-3.5 pe-2 h-11 border-b border-default">
        <h2 class="flex-1 text-sm font-semibold text-highlighted">
          Notifications
        </h2>
        <UButton
          v-if="centre.notices.value.length"
          label="Clear all"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="centre.clear()"
        />
      </header>

      <AppEmpty
        v-if="!centre.notices.value.length"
        illustration="no-notifications"
        title="Nothing to tell you"
        description="New mail, snoozes that come back, messages nobody answered and anything that couldn’t be sent will show here."
        size="sm"
        class="py-8 px-4"
      />

      <TransitionGroup
        v-else
        name="lb-list"
        tag="ul"
        class="relative flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-0.5"
      >
        <li
          v-for="notice in centre.notices.value"
          :key="notice.id"
          class="group relative"
        >
          <button
            type="button"
            class="w-full flex items-start gap-2.5 px-2 py-2 rounded-md text-start transition-colors duration-(--lb-dur-1) hover:bg-elevated lb-focus"
            @click="act(notice)"
          >
            <UIcon
              :name="NOTICE_ICONS[notice.kind]"
              class="size-4 mt-0.5 shrink-0"
              :class="notice.kind === 'failed' ? 'text-error' : notice.read ? 'text-muted' : 'text-primary'"
            />
            <span class="flex-1 min-w-0">
              <span class="flex items-baseline gap-2">
                <span
                  class="flex-1 truncate text-sm"
                  :class="notice.read ? 'text-toned' : 'font-semibold text-highlighted'"
                >{{ notice.title }}</span>
                <span class="shrink-0 text-xs text-muted tabular-nums">{{ when(notice.at) }}</span>
              </span>
              <span
                v-if="notice.body"
                class="block text-xs text-muted line-clamp-2"
              >{{ notice.body }}</span>
              <span
                v-if="notice.mailbox && notice.mailbox !== account?.email.toLowerCase()"
                class="block text-xs text-muted truncate"
              >In {{ notice.mailbox }}</span>
            </span>
            <span
              v-if="!notice.read"
              class="sr-only"
            >New</span>
          </button>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            :aria-label="`Dismiss: ${notice.title}`"
            class="absolute end-1 bottom-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted"
            @click="centre.remove(notice.id)"
          />
        </li>
      </TransitionGroup>
    </template>
  </UPopover>
</template>
