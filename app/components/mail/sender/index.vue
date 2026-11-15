<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
  /** In a conversation's card, whose header already shows who and when: only the recipients and what hangs under them */
  compact?: boolean
}>()

const { compose } = useComposer()
const { showDay } = useMail()
const expanded = ref(false)

const recipients = computed(() => [
  { label: 'To', list: props.message.to },
  { label: 'Cc', list: props.message.cc },
  { label: 'Reply to', list: props.message.replyTo }
].filter(row => row.list.length))

const summary = computed(() => {
  const names = [...props.message.to, ...props.message.cc].map(personName)
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
})

// A quiet "3 min read" by the date; nothing for a message read in under a minute
const minutes = computed(() => readingMinutes(messageText(props.message)))
</script>

<template>
  <div class="flex items-start gap-3">
    <!-- Resting the pointer on the sender brings up their card -->
    <ContactCard
      v-if="!compact"
      :address="message.from"
    >
      <span class="shrink-0 flex rounded-full">
        <SenderAvatar
          :address="message.from"
          size="xl"
        />
      </span>
    </ContactCard>

    <div class="flex-1 min-w-0">
      <div
        v-if="!compact"
        class="flex items-baseline gap-2 flex-wrap"
      >
        <ContactCard :address="message.from">
          <UButton
            :label="personName(message.from)"
            color="neutral"
            variant="link"
            class="p-0 font-semibold text-highlighted min-w-0 max-w-full"
            @click="compose([message.from])"
          />
        </ContactCard>
        <MailAddressCopy
          v-if="message.from.address"
          :address="message.from"
          bare
          class="text-sm text-muted min-w-0"
        />
        <span class="ms-auto flex items-baseline gap-2 text-sm text-muted tabular-nums">
          <span
            v-if="minutes"
            class="text-muted lb-in"
          >{{ minutes }} min read</span>
          <RevealButton
            icon="i-lucide-calendar-search"
            :aria-label="`Show Inbox mail from ${fullDate(message.date)}`"
            @click="showDay(message.date)"
          >
            <time :datetime="message.date">{{ fullDate(message.date) }}</time>
          </RevealButton>
        </span>
      </div>

      <UButton
        :label="expanded ? 'Hide recipients' : compact ? 'Recipients' : `To ${summary || 'undisclosed recipients'}`"
        trailing-icon="i-lucide-chevron-down"
        color="neutral"
        variant="link"
        size="sm"
        class="p-0 text-muted max-w-full"
        :aria-expanded="expanded"
        :ui="{ label: 'truncate', trailingIcon: ['transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-180'] }"
        @click="expanded = !expanded"
      />

      <div
        class="lb-expand"
        :data-open="expanded"
        :inert="!expanded"
      >
        <div>
          <dl class="pt-2 grid grid-cols-[3.75rem_1fr] items-start gap-x-2 gap-y-1.5">
            <template
              v-for="row in recipients"
              :key="row.label"
            >
              <dt class="text-xs leading-6 text-muted">
                {{ row.label }}
              </dt>
              <dd class="flex flex-wrap items-center gap-1 min-w-0">
                <MailAddressCopy
                  v-for="address in row.list"
                  :key="address.address"
                  :address="address"
                  chip
                  class="max-w-full"
                />
              </dd>
            </template>
          </dl>
        </div>
      </div>

      <slot />
    </div>
  </div>
</template>
