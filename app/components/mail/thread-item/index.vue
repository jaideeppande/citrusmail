<script setup lang="ts">
// One message of a conversation: a one-line header that opens to the message
// itself. A message on its own is `bare`: no header and no card, read as ever
const props = defineProps<{
  entry: ThreadEntry
  open: boolean
  bare?: boolean
  /** Minutes it takes to read, once the message is loaded; 0 hides it */
  minutes?: number
}>()

const emit = defineEmits<{
  toggle: []
}>()

const message = computed(() => props.entry.summary)

/** "to me", "to Ana, Ben and 2 more" under an open message's name */
const recipients = computed(() => {
  const names = message.value.to.map(personName)
  if (!names.length) return ''
  return `to ${names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(', ')}`
})
</script>

<template>
  <section
    :class="!bare && 'rounded-lg ring ring-default bg-default transition-shadow duration-(--lb-dur-2) data-[open=true]:shadow-xs'"
    :data-open="open"
  >
    <button
      v-if="!bare"
      type="button"
      class="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start lb-focus transition-colors duration-(--lb-dur-1) hover:bg-elevated/50"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <ContactCard :address="message.from">
        <span class="shrink-0 flex">
          <SenderAvatar
            :address="message.from"
            size="sm"
          />
        </span>
      </ContactCard>

      <span class="flex-1 min-w-0 flex items-baseline gap-2">
        <span
          class="shrink-0 max-w-[45%] truncate text-sm text-highlighted"
          :class="message.unread ? 'font-semibold' : 'font-medium'"
        >{{ entry.mine ? 'You' : personName(message.from) }}</span>
        <span
          :key="open ? 'to' : 'preview'"
          class="flex-1 min-w-0 truncate text-sm text-muted lb-in"
        >{{ open ? recipients : message.preview }}</span>
      </span>

      <span class="shrink-0 flex items-center gap-2 text-xs text-muted tabular-nums">
        <span
          v-if="message.unread"
          class="size-2 rounded-full bg-(--lb-unread)"
          aria-label="Unread"
        />
        <UIcon
          v-if="message.hasAttachments && !open"
          name="i-lucide-paperclip"
          class="size-3.5"
        />
        <span v-if="open && minutes">{{ minutes }} min read</span>
        <time
          :datetime="message.date"
          :title="fullDate(message.date)"
        >{{ listDate(message.date) }}</time>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-dimmed transition-transform duration-(--lb-dur-2) ease-(--lb-ease-out)"
          :class="open && 'rotate-180'"
        />
      </span>
    </button>

    <Transition name="lb-collapse">
      <div v-show="open || bare">
        <div :class="!bare && 'px-4 pt-1 pb-1'">
          <slot />
        </div>
      </div>
    </Transition>
  </section>
</template>
