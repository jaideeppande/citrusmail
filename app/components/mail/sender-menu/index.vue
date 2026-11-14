<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// More for this message: print it, put it on the calendar, give it a window
// of its own, pin or snooze it, and who it's from goes on your allow or block list
const props = defineProps<{
  message: MessageDetail
  /** Its row in the list, when it is on it: pinning and snoozing act on that */
  summary?: MessageSummary
}>()

const emit = defineEmits<{
  print: []
  event: []
  /** "Pick a time…" under Snooze: the header's snooze picker takes it from here */
  pickSnooze: []
}>()

const { allow, block, remove, isAllowed, isBlocked } = useSenders()
const { account } = useShell()
const { togglePin, isPinned, snooze } = useMail()
const { kbds } = useShortcutKeys()
const mailEvent = useMailEvent()

const address = computed(() => props.message.from.address)
const domain = computed(() => `@${address.value.split('@')[1] ?? ''}`)

const items = computed<DropdownMenuItem[][]>(() => {
  const summary = props.summary
  const groups: DropdownMenuItem[][] = [[
    { label: 'Print…', icon: 'i-lucide-printer', kbds: kbds('mail.print'), onSelect: () => emit('print') },
    ...(mailEvent.available.value ? [{ label: 'Add to calendar…', icon: 'i-lucide-calendar-plus', onSelect: () => emit('event') }] : []),
    // A pop-out is already the message in a window of its own
    ...(windowKind() === 'main'
      ? [{ label: 'Open in new window', icon: 'i-lucide-picture-in-picture-2', kbds: kbds('window.popout'), onSelect: () => openPopout(`${folderLink(props.message.folder)}?m=${encodeURIComponent(props.message.id)}`) }]
      : [])
  ]]

  if (summary) {
    groups.push([
      { label: isPinned(summary) ? 'Unpin' : 'Pin to top', icon: isPinned(summary) ? 'i-lucide-pin-off' : 'i-lucide-pin', kbds: kbds('mail.pin'), onSelect: () => togglePin(summary) },
      {
        label: 'Snooze',
        icon: 'i-lucide-alarm-clock',
        children: [
          snoozePresets().map(preset => ({ label: preset.label, icon: preset.icon, onSelect: () => snooze([summary], preset.date) })),
          [{ label: 'Pick a time…', icon: 'i-lucide-calendar-clock', onSelect: () => emit('pickSnooze') }]
        ]
      }
    ])
  }

  if (address.value && account.value?.protocol !== 'pop3') {
    const allowed = isAllowed(address.value)
    const blocked = isBlocked(address.value)
    groups.push([
      allowed
        ? { label: `Remove ${address.value} from allowed`, icon: 'i-lucide-shield-minus', onSelect: () => remove(address.value) }
        : { label: 'Always allow this sender', description: 'Their images load, and their mail never lands in Junk', icon: 'i-lucide-shield-check', onSelect: () => allow(address.value) }
    ], [
      blocked
        ? { label: `Unblock ${address.value}`, icon: 'i-lucide-shield-off', onSelect: () => remove(address.value) }
        : { label: `Block ${address.value}`, icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => block(address.value) },
      { label: `Block everyone at ${domain.value}`, icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => block(domain.value) }
    ])
  }
  return groups
})
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
  >
    <UTooltip text="More">
      <UButton
        icon="i-lucide-ellipsis"
        color="neutral"
        variant="ghost"
        aria-label="More"
        class="lb-press"
      />
    </UTooltip>
  </UDropdownMenu>
</template>
