<script setup lang="ts">
// Quiet chips under the sender for what the message's own words offer: a
// date for the calendar, a parcel to follow, a phone number or a sign-in code
// to copy. Never links: see app/utils/message-actions.ts
const props = defineProps<{
  message: MessageDetail
}>()

const toast = useToast()
const mailEvent = useMailEvent()
const { copy } = useClipboard({ legacy: true })

const actions = computed(() => {
  // What the sender wrote, not the message quoted under it
  const text = `${props.message.subject}\n${writtenPart(messageText(props.message))}`
  return detectActions(text).filter(action => action.kind !== 'date' || mailEvent.available.value)
})

const ICONS: Record<MessageAction['kind'], string> = {
  date: 'i-lucide-calendar-plus',
  tracking: 'i-lucide-package-search',
  phone: 'i-lucide-phone',
  code: 'i-lucide-key-round'
}

// The chip that was just copied shows a check for a moment
const done = ref<string>()
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

async function copyValue(value: string, label: string) {
  try {
    await copy(value)
    done.value = label
    clearTimeout(timer)
    timer = setTimeout(() => (done.value = undefined), 1400)
  } catch {
    toast.add({ title: 'Couldn’t copy', description: value, color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

function run(action: MessageAction) {
  if (action.kind === 'date') mailEvent.fromMessage(props.message, action)
  else if (action.kind === 'phone') copyValue(action.number, action.label)
  else if (action.kind === 'code') copyValue(action.code, action.label)
}
</script>

<template>
  <ul
    v-if="actions.length"
    class="flex flex-wrap gap-1.5"
    aria-label="Suggested actions"
  >
    <li
      v-for="(action, index) in actions"
      :key="action.label"
      class="lb-stagger max-w-full"
      :style="{ '--lb-i': index }"
    >
      <!-- A parcel opens the carrier's own tracking page in the browser -->
      <UButton
        v-if="action.kind === 'tracking'"
        :to="action.url"
        target="_blank"
        external
        rel="noopener noreferrer"
        :label="action.label"
        :icon="ICONS.tracking"
        trailing-icon="i-lucide-arrow-up-right"
        color="neutral"
        variant="outline"
        size="xs"
        class="rounded-full lb-press max-w-full"
        :ui="{ label: 'truncate', leadingIcon: 'text-muted', trailingIcon: 'size-3 text-muted' }"
        :title="`${action.carrier} ${action.number}`"
      />
      <UButton
        v-else
        :label="done === action.label ? 'Copied' : action.label"
        :icon="done === action.label ? 'i-lucide-check' : ICONS[action.kind]"
        color="neutral"
        variant="outline"
        size="xs"
        class="rounded-full lb-press max-w-full"
        :ui="{ label: 'truncate', leadingIcon: done === action.label ? 'text-primary' : 'text-muted' }"
        @click="run(action)"
      />
    </li>
  </ul>
</template>
