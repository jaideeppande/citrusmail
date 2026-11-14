<script setup lang="ts">
// One line per message for the list-only view: who, subject and the start
// of the message, date. Hovering swaps the date for quick actions
const props = defineProps<{
  message: MessageSummary
  selected: boolean
  /** Sent and Drafts show who it went to rather than who it came from */
  sent?: boolean
  /** The Screen tab: the row offers to let the sender in or keep them out */
  screen?: boolean
}>()

const menu = useMessageActions(() => props.message)
const row = useMailRow(props)

const person = computed(() => props.sent ? `To ${props.message.to.map(personName).join(', ') || 'no one yet'}` : row.person.value)
</script>

<template>
  <UContextMenu :items="menu.items.value">
    <div
      class="group relative border-b border-default"
      :class="[selected && 'shadow-[inset_2px_0_0_var(--lb-selected-edge)]', row.motion.value]"
      :data-checking="row.checking.value || undefined"
      draggable="true"
      @dragstart="row.onDragStart"
    >
      <UButton
        :data-id="message.id"
        :aria-current="selected || undefined"
        color="neutral"
        variant="ghost"
        block
        class="h-(--lb-row-compact) items-center justify-start text-start gap-3 ps-2 pe-4 py-0 rounded-none font-normal text-sm transition-colors duration-(--lb-dur-1)"
        :class="row.checked.value ? 'bg-primary/8 hover:bg-primary/10' : selected ? 'bg-(--lb-selected) hover:bg-(--lb-selected)' : row.unread.value ? 'hover:bg-elevated/60' : 'bg-elevated/25 hover:bg-elevated/60'"
        @click="row.onClick"
      >
        <span
          class="lb-row-avatar"
          data-dot
        >
          <span
            class="size-2 rounded-full transition-colors duration-(--lb-dur-2)"
            :class="row.unread.value ? 'bg-(--lb-unread)' : 'bg-transparent'"
            :aria-label="row.unread.value ? 'Unread' : undefined"
          />
          <MailRowCheck
            :checked="row.checked.value"
            @click.stop="row.onCheck"
          />
        </span>
        <span
          class="w-44 shrink-0 truncate"
          :class="row.unread.value ? 'font-semibold text-highlighted' : 'text-toned'"
        >{{ person }}</span>

        <span class="flex-1 min-w-0 truncate">
          <UBadge
            v-if="row.count.value > 1"
            :label="String(row.count.value)"
            color="neutral"
            variant="subtle"
            size="sm"
            class="me-1.5 tabular-nums align-[1px]"
            :aria-label="`${row.count.value} messages`"
          />
          <span :class="row.unread.value ? 'font-semibold text-highlighted' : 'text-default'">{{ message.subject || '(No subject)' }}</span>
          <span
            v-if="message.preview"
            class="text-muted"
          > – {{ message.preview }}</span>
        </span>

        <span class="shrink-0 flex items-center gap-1.5 text-xs text-muted tabular-nums group-hover:invisible in-data-checking:visible">
          <span
            v-if="row.waiting.value !== undefined"
            class="inline-flex items-center gap-1 text-warning"
          >
            <UIcon
              name="i-lucide-hourglass"
              class="size-3"
            />{{ row.waiting.value }}d
          </span>
          <UIcon
            v-if="row.returned.value"
            name="i-lucide-alarm-clock-check"
            class="size-3.5 text-primary"
            aria-label="Back from snooze"
          />
          <MailReceiptBadge
            v-if="message.receipt"
            :receipt="message.receipt"
          />
          <UIcon
            v-if="row.pinned.value"
            name="i-ph-push-pin-fill"
            class="size-3.5 text-primary lb-mark-pop"
            aria-label="Pinned"
          />
          <UIcon
            v-if="row.hasAttachments.value"
            name="i-lucide-paperclip"
            class="size-3.5"
            aria-label="Has attachments"
          />
          <UIcon
            v-if="row.flagged.value"
            name="i-ph-flag-fill"
            class="size-3.5 text-(--lb-flag) lb-mark-pop"
            aria-label="Flagged"
          />
          <span
            class="w-14 text-end"
            :class="row.unread.value && 'font-semibold text-highlighted'"
          >{{ listDate(message.date) }}</span>
        </span>
      </UButton>

      <MailRowActions
        :message="message"
        :screen="screen"
        :waiting="row.waiting.value !== undefined"
        class="absolute top-1/2 -translate-y-1/2 end-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-(--lb-dur-1) in-data-checking:hidden"
      />
    </div>
  </UContextMenu>
</template>
