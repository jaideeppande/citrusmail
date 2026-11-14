// The What’s new panel. It opens by itself once after an update: the version
// last seen on this computer is compared with the one that's running
const _useWhatsNew = () => {
  const version = (useRuntimeConfig().public.version as string | undefined) ?? ''
  const seen = useLocalPref<string>('seen-version', '')
  const isOpen = ref(false)

  /** This version hasn't been looked at on this computer yet */
  const unseen = computed(() => !!version && seen.value !== version)

  function open() {
    isOpen.value = true
  }

  function dismiss() {
    isOpen.value = false
    if (version) seen.value = version
  }

  /** A first install has nothing that's new to it: the tour is its introduction */
  function markSeen() {
    if (version) seen.value = version
  }

  useCommands(() => [{
    id: 'whats-new',
    label: 'Help',
    items: [{ label: 'What’s new', icon: 'i-lucide-gift', onSelect: open }]
  }])

  return { version, isOpen, unseen, firstRun: computed(() => seen.value === ''), open, dismiss, markSeen }
}

export const useWhatsNew = createAppComposable(_useWhatsNew)
