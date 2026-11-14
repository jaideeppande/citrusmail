// Do not disturb: no sounds or banners for a while, apart from mail from
// your VIPs. Kept on this computer and shared by every window, so turning it
// on in one quiets them all
const _useDoNotDisturb = () => {
  const state = useLocalPref<DndState>('dnd', { until: 0 })
  // Ticks so the indicator goes away by itself when the hour is up
  const now = useNow({ interval: 15_000 })

  const until = computed(() => state.value.until)
  const active = computed(() => dndActive(state.value.until, now.value.getTime()))

  function set(mode: DndMode) {
    state.value = { mode, until: mode === 'hour' ? Date.now() + 3_600_000 : mode === 'morning' ? dndMorning() : -1 }
  }

  function clear() {
    state.value = { until: 0 }
  }

  /** “Until 14:30”, “Until tomorrow at 08:00”, “Until you turn it off”; empty when off */
  const label = computed(() => {
    if (!active.value) return ''
    if (until.value === -1) return 'Until you turn it off'
    const end = new Date(until.value)
    const time = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return end.toDateString() === now.value.toDateString() ? `Until ${time}` : `Until tomorrow at ${time}`
  })

  useCommands(() => [{
    id: 'dnd',
    label: 'Notifications',
    items: active.value
      ? [{ label: 'Turn off do not disturb', icon: 'i-lucide-bell-ring', onSelect: clear }]
      : [
          { label: 'Do not disturb for 1 hour', icon: 'i-lucide-bell-off', onSelect: () => set('hour') },
          { label: 'Do not disturb until tomorrow morning', icon: 'i-lucide-bell-off', onSelect: () => set('morning') },
          { label: 'Do not disturb until I turn it off', icon: 'i-lucide-bell-off', onSelect: () => set('on') }
        ]
  }])

  /** The choice that's in force, for Settings to show as chosen */
  const mode = computed<DndMode | 'off'>(() => !active.value ? 'off' : state.value.mode ?? (until.value === -1 ? 'on' : 'hour'))

  return { active, until, mode, label, set, clear }
}

export const useDoNotDisturb = createAppComposable(_useDoNotDisturb)

/**
 * The people and domains whose mail still rings during quiet hours and do
 * not disturb. `mine` is the open mailbox's list; `of` reads any mailbox's,
 * since new mail is watched for all of them at once
 */
export function useVips() {
  const mine = useAccountPref<string[]>('vips', () => [])
  const all = useLocalPref<Record<string, string[]>>('vips', {})

  function of(mailbox: string): string[] {
    const key = mailbox.toLowerCase()
    return Object.entries(all.value).find(([email]) => email.toLowerCase() === key)?.[1] ?? []
  }

  return { mine, of }
}
