<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Send, with Send later beside it: a few usual times, the recipient's
// morning where they are, when they usually write back, or exactly when you choose
const { sending, send, draft } = useComposer()
const { account } = useShell()
const { messages } = useMail()
const { kbds } = useShortcutKeys()
const { timeZoneOf } = useContactExtras()
const { noteIncoming, usualHour } = useReplyHours()
const prefs = usePrefs()
// Also opened by /later in the editor
const { later: customOpen } = useComposerTools()

// Read again each time the menu opens: "Tonight" is in the past by morning
const opened = ref(0)
function onOpen(value: boolean) {
  if (!value) return
  // The loaded mail is what the reply times are learnt from
  noteIncoming(messages.value)
  opened.value++
}

const firstName = (person: Address) => personName(person).split(/\s+/)[0] || person.address

/** The first To recipient whose time zone is known and differs from yours (Cc after) */
const theirZone = computed(() => {
  const mine = myTimeZone()
  for (const person of [...draft.value.to, ...draft.value.cc]) {
    const zone = timeZoneOf(person.address)
    if (isTimeZone(zone) && zonesDiffer(zone, mine)) return { person, zone }
  }
  return undefined
})

/** When the first To recipient usually writes back, once there is enough mail to say */
const usual = computed(() => {
  const person = draft.value.to[0]
  if (!person) return undefined
  const found = usualHour(person.address)
  return found && { person, ...found }
})

const items = computed<DropdownMenuItem[][]>(() => {
  if (opened.value < 0) return []
  const groups: DropdownMenuItem[][] = [
    [{ type: 'label', label: 'Send later' }],
    sendLaterPresets().map(preset => ({
      label: preset.label,
      description: scheduleLabel(preset.date.toISOString()),
      icon: preset.icon,
      onSelect: () => send(preset.date)
    }))
  ]
  const personal: DropdownMenuItem[] = []
  if (theirZone.value) {
    const { person, zone } = theirZone.value
    const date = nextTimeInZone(zone, 8, 30)
    personal.push({
      label: `${firstName(person)}’s morning`,
      description: `8:30 in ${zoneCity(zone)}, ${scheduleLabel(date.toISOString())} for you`,
      icon: 'i-lucide-sunrise',
      onSelect: () => send(date)
    })
  }
  if (usual.value) {
    const { person, hour, samples } = usual.value
    const date = nextLocalHour(hour)
    personal.push({
      label: `When ${firstName(person)} usually replies: around ${hourLabel(hour)}`,
      description: `An estimate from ${samples} of their messages here · ${scheduleLabel(date.toISOString())}`,
      icon: 'i-lucide-message-circle-reply',
      onSelect: () => send(date)
    })
  }
  if (personal.length) groups.push(personal)
  groups.push([{ label: 'Custom time…', icon: 'i-lucide-calendar-clock', onSelect: () => (customOpen.value = true) }])
  return groups
})
</script>

<template>
  <UFieldGroup>
    <UTooltip
      :text="prefs.undoSend > 0 ? 'Send, with a moment to undo' : 'Send'"
      :kbds="kbds('compose.send')"
    >
      <UButton
        label="Send"
        trailing-icon="i-lucide-send-horizontal"
        :loading="sending"
        class="lb-press px-4"
        @click="send()"
      />
    </UTooltip>
    <UDropdownMenu
      v-if="account?.protocol"
      :items="items"
      :content="{ side: 'top', align: 'end' }"
      :ui="{ content: 'min-w-72 max-w-96', itemDescription: 'whitespace-normal' }"
      @update:open="onOpen"
    >
      <UButton
        icon="i-lucide-chevron-up"
        aria-label="Send later"
        :disabled="sending"
        class="border-s border-inverted/20 px-2"
      />
    </UDropdownMenu>
  </UFieldGroup>

  <MailSendLaterModal
    v-model:open="customOpen"
    @pick="send"
  />
</template>
