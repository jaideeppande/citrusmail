// The What’s new panel. It opens by itself once for each new set of
// highlights: the release last seen on this computer is compared with the one
// in app/utils/whats-new.ts. Keyed on the release rather than the version
// number, so new highlights show even when the version hasn't moved
const _useWhatsNew = () => {
  const version = (useRuntimeConfig().public.version as string | undefined) ?? ''
  const seen = useLocalPref<string>('seen-release', '')
  // Before releases were named, the version was remembered: someone who has
  // one on record has used the app here, so isn't a first run
  const seenVersion = useLocalPref<string>('seen-version', '')
  const isOpen = ref(false)

  /** These highlights haven't been looked at on this computer yet */
  const unseen = computed(() => seen.value !== RELEASE_ID)

  function open() {
    isOpen.value = true
  }

  function dismiss() {
    isOpen.value = false
    seen.value = RELEASE_ID
  }

  /** A first install has nothing that's new to it: the tour is its introduction */
  function markSeen() {
    seen.value = RELEASE_ID
  }

  useCommands(() => [{
    id: 'whats-new',
    label: 'Help',
    items: [{ label: 'What’s new', icon: 'i-lucide-gift', onSelect: open }]
  }])

  return { version, isOpen, unseen, firstRun: computed(() => seen.value === '' && seenVersion.value === ''), open, dismiss, markSeen }
}

export const useWhatsNew = createAppComposable(_useWhatsNew)
