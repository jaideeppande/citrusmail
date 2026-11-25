<script setup lang="ts">
const props = defineProps<{
  message: MessageSummary
  /** The Screen tab: let the sender in, or keep them out */
  screen?: boolean
  /** A sent message nobody answered: offers to follow up */
  waiting?: boolean
}>()

const { folder, setUnreadMany, toggleFlag, move, remove, threadInfo, inboxTabs } = useMail()
const { kbds } = useShortcutKeys()
const nudges = useNudges()

const unread = computed(() => threadInfo(props.message)?.unread ?? props.message.unread)
// Read again each time the menu opens: "Tomorrow morning" is another day by then
const snoozeOpened = ref(0)
const snoozes = computed(() => snoozeOpened.value >= 0 ? [snoozeItems(() => [props.message])] : [])
</script>

<template>
  <div class="flex items-center rounded-md bg-default ring ring-default p-0.5 shadow-xs">
    <template v-if="screen">
      <UButton
        label="Allow"
        icon="i-lucide-check"
        color="primary"
        variant="soft"
        size="xs"
        @click.stop="inboxTabs?.accept(props.message)"
      />
      <UTooltip text="Let this one through without allowing the sender">
        <UButton
          icon="i-lucide-inbox"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Let this one through"
          @click.stop="inboxTabs?.acceptOnce(props.message)"
        />
      </UTooltip>
      <UButton
        label="Block"
        icon="i-lucide-ban"
        color="neutral"
        variant="ghost"
        size="xs"
        @click.stop="inboxTabs?.reject(props.message)"
      />
    </template>
    <template v-else>
      <UButton
        v-if="waiting"
        label="Follow up"
        icon="i-lucide-reply"
        color="neutral"
        variant="ghost"
        size="xs"
        @click.stop="nudges.followUp(props.message)"
      />
      <UTooltip
        v-if="folder?.role !== 'archive'"
        text="Archive"
        :kbds="kbds('mail.archive')"
      >
        <UButton
          icon="i-lucide-archive"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Archive"
          @click.stop="move(props.message, 'archive')"
        />
      </UTooltip>
      <UTooltip
        text="Delete"
        :kbds="kbds('mail.delete')"
      >
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Delete"
          @click.stop="remove(props.message)"
        />
      </UTooltip>
      <UDropdownMenu
        :items="snoozes"
        :content="{ align: 'end' }"
        :ui="{ content: 'min-w-56' }"
        @update:open="$event && snoozeOpened++"
      >
        <UTooltip
          text="Snooze"
          :kbds="kbds('mail.snooze')"
        >
          <UButton
            icon="i-lucide-alarm-clock"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Snooze"
            @click.stop
          />
        </UTooltip>
      </UDropdownMenu>
      <UTooltip :text="unread ? 'Mark as read' : 'Mark as unread'">
        <UButton
          :icon="unread ? 'i-lucide-mail-open' : 'i-lucide-mail'"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="unread ? 'Mark as read' : 'Mark as unread'"
          @click.stop="setUnreadMany([props.message], !unread)"
        />
      </UTooltip>
      <UTooltip
        :text="message.flagged ? 'Remove flag' : 'Flag'"
        :kbds="kbds('mail.flag')"
      >
        <UButton
          :icon="message.flagged ? 'i-ph-flag-fill' : 'i-lucide-flag'"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="message.flagged ? 'Remove flag' : 'Flag'"
          :ui="{ leadingIcon: message.flagged ? 'text-(--lb-flag)' : '' }"
          @click.stop="toggleFlag(props.message)"
        />
      </UTooltip>
    </template>
  </div>
</template>
