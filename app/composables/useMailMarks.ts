export interface Snoozed {
  key: string
  /** When it comes back, ms since epoch */
  until: number
  /** The row as it was, so the Snoozed list can show it without the server */
  message: MessageSummary
}

// Pins and snoozes. Neither is something a mail server knows about, so both
// are kept on this computer, per mailbox: a pinned message stays at the top
// of its folder, a snoozed one stays out of sight until its time comes
const _useMailMarks = () => {
  const pins = useAccountPref<string[]>('pins', () => [])
  const snoozed = useAccountPref<Snoozed[]>('snoozed', () => [])
  /** Back from snooze and not opened since: these lead the list */
  const returned = useAccountPref<string[]>('returned', () => [])

  const pinSet = computed(() => new Set(pins.value))
  const snoozeSet = computed(() => new Set(snoozed.value.map(item => item.key)))
  const returnedSet = computed(() => new Set(returned.value))

  const isPinned = (message: MessageSummary) => pinSet.value.has(messageKey(message))
  const isSnoozed = (message: MessageSummary) => snoozeSet.value.has(messageKey(message))
  const isReturned = (message: MessageSummary) => returnedSet.value.has(messageKey(message))

  function togglePin(message: MessageSummary) {
    const key = messageKey(message)
    pins.value = pinSet.value.has(key) ? pins.value.filter(item => item !== key) : [...pins.value, key]
  }

  function snooze(messages: MessageSummary[], until: Date) {
    const keys = new Set(messages.map(messageKey))
    snoozed.value = [
      ...snoozed.value.filter(item => !keys.has(item.key)),
      ...messages.map(message => ({ key: messageKey(message), until: until.getTime(), message }))
    ].sort((a, b) => a.until - b.until)
    returned.value = returned.value.filter(key => !keys.has(key))
  }

  /** Brings messages back now. `mark` puts them at the top as returned */
  function wake(keys: string[], mark = false) {
    const set = new Set(keys)
    snoozed.value = snoozed.value.filter(item => !set.has(item.key))
    if (mark) returned.value = [...new Set([...returned.value, ...keys])].slice(-50)
  }

  function clearReturned(message: MessageSummary) {
    const key = messageKey(message)
    if (returnedSet.value.has(key)) returned.value = returned.value.filter(item => item !== key)
  }

  /** A message that left its folder takes its marks with it */
  function forget(messages: MessageSummary[]) {
    const keys = new Set(messages.map(messageKey))
    if (pins.value.some(key => keys.has(key))) pins.value = pins.value.filter(key => !keys.has(key))
    if (snoozed.value.some(item => keys.has(item.key))) snoozed.value = snoozed.value.filter(item => !keys.has(item.key))
    if (returned.value.some(key => keys.has(key))) returned.value = returned.value.filter(key => !keys.has(key))
  }

  // Whatever is due comes back. Every window runs this, and the first one to
  // notice empties the shared list, so a message only returns once
  const woke = createEventHook<{ due: Snoozed[] }>()
  function check() {
    const now = Date.now()
    const due = snoozed.value.filter(item => item.until <= now)
    if (!due.length) return
    wake(due.map(item => item.key), true)
    woke.trigger({ due })
  }
  useIntervalFn(check, 20_000)
  onNuxtReady(check)

  return { pins, snoozed, isPinned, isSnoozed, isReturned, togglePin, snooze, wake, clearReturned, forget, onWoke: woke.on }
}

export const useMailMarks = createAppComposable(_useMailMarks)

/** "today at 19:00", "tomorrow at 8:00" or "Mon 12 Jan at 8:00" */
export function snoozeLabel(until: number | Date) {
  return scheduleLabel(new Date(until).toISOString())
}
