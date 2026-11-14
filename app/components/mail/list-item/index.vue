<script setup lang="ts">
const props = defineProps<{
  message: MessageSummary
  selected: boolean
  /** Sent and Drafts show who it went to rather than who it came from */
  sent?: boolean
  /** A short line under the preview, e.g. the folder an AI search found it in */
  note?: string
  /** The Screen tab: the row offers to let the sender in or keep them out */
  screen?: boolean
}>()

const menu = useMessageActions(() => props.message)
const row = useMailRow(props)

const avatarAddress = computed(() => props.sent ? props.message.to[0] : props.message.from)
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
        class="items-start justify-start text-start gap-3 ps-2 pe-4 py-(--lb-row-y) rounded-none font-normal transition-colors duration-(--lb-dur-1)"
        :class="row.checked.value ? 'bg-primary/8 hover:bg-primary/10' : selected ? 'bg-(--lb-selected) hover:bg-(--lb-selected)' : 'hover:bg-elevated/60'"
        @click="row.onClick"
      >
        <span
          class="mt-[15px] size-2 shrink-0 rounded-full transition-colors duration-(--lb-dur-2)"
          :class="row.unread.value ? 'bg-(--lb-unread)' : 'bg-transparent'"
          :aria-label="row.unread.value ? 'Unread' : undefined"
        />

        <span class="lb-row-avatar">
          <SenderAvatar
            :address="avatarAddress"
            size="md"
          />
          <MailRowCheck
            :checked="row.checked.value"
            @click.stop="row.onCheck"
          />
        </span>

        <span class="flex-1 min-w-0">
          <span class="flex items-baseline gap-2">
            <span
              class="flex-1 truncate text-[15px] text-highlighted"
              :class="row.unread.value ? 'font-semibold' : 'font-medium'"
            >
              <span
                v-if="sent"
                class="text-muted font-normal"
              >To </span>{{ row.person.value }}
            </span>
            <span class="shrink-0 flex items-center gap-1.5 text-xs text-muted tabular-nums">
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
              {{ listDate(message.date) }}
            </span>
          </span>

          <span class="flex items-center gap-2 mt-(--lb-row-gap)">
            <span
              class="flex-1 truncate text-sm"
              :class="row.unread.value ? 'font-semibold text-highlighted' : 'text-toned'"
            >{{ message.subject || '(No subject)' }}</span>
            <UBadge
              v-if="row.count.value > 1"
              :label="String(row.count.value)"
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0 tabular-nums"
              :aria-label="`${row.count.value} messages`"
            />
            <MailReceiptBadge
              v-if="message.receipt"
              :receipt="message.receipt"
            />
          </span>

          <span class="block text-sm text-muted truncate mt-(--lb-row-gap)">
            {{ message.preview }}
          </span>
          <span
            v-if="note || row.returned.value || row.waiting.value !== undefined"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-dimmed"
          >
            <span
              v-if="row.returned.value"
              class="inline-flex items-center gap-1 text-primary"
            >
              <UIcon
                name="i-lucide-alarm-clock-check"
                class="size-3"
              />Back from snooze
            </span>
            <span
              v-if="row.waiting.value !== undefined"
              class="inline-flex items-center gap-1 text-warning"
            >
              <UIcon
                name="i-lucide-hourglass"
                class="size-3"
              />No reply in {{ row.waiting.value }} {{ row.waiting.value === 1 ? 'day' : 'days' }}
            </span>
            <span
              v-if="note"
              class="inline-flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-folder"
                class="size-3"
              />{{ note }}
            </span>
          </span>
        </span>
      </UButton>

      <MailRowActions
        :message="message"
        :screen="screen"
        :waiting="row.waiting.value !== undefined"
        class="absolute top-2 end-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-(--lb-dur-1) in-data-checking:hidden"
      />
    </div>
  </UContextMenu>
</template>
