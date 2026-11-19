// "Pick a time" for a snooze: one dialog for the whole app, opened with the
// messages it's for
const _useSnoozePicker = () => {
  const isOpen = ref(false)
  const messages = shallowRef<MessageSummary[]>([])

  function pick(list: MessageSummary[]) {
    messages.value = list
    isOpen.value = true
  }

  return { isOpen, messages, pick }
}

export const useSnoozePicker = createAppComposable(_useSnoozePicker)

/** The snooze choices as menu items, for a dropdown or a right-click menu */
export function snoozeItems(list: () => MessageSummary[]) {
  const { snooze } = useMail()
  const { pick } = useSnoozePicker()
  return [
    ...snoozePresets().map(preset => ({
      label: preset.label,
      icon: preset.icon,
      // Shown on the right, where a menu puts its shortcut
      kbds: undefined,
      description: snoozeLabel(preset.date),
      onSelect: () => snooze(list(), preset.date)
    })),
    { label: 'Pick a time…', icon: 'i-lucide-calendar-clock', onSelect: () => pick(list()) }
  ]
}
