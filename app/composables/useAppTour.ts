// The first-run tour: a few coach marks over the real controls. Shown once
// after the first sign-in, and again whenever it's asked for in Settings → About
const _useAppTour = () => {
  const seen = useLocalPref<{ done: boolean }>('tour', { done: false })
  const active = ref(false)

  function start() {
    active.value = true
  }

  /** Finished or skipped, it doesn't start by itself again */
  function finish() {
    active.value = false
    if (!seen.value.done) seen.value = { done: true }
  }

  /** Nothing to point at just now: put away without counting as seen */
  function cancel() {
    active.value = false
  }

  /** From Settings: the controls it points at are on the mail page */
  async function replay() {
    await navigateTo('/mail/INBOX')
    start()
  }

  useCommands(() => [{
    id: 'tour',
    label: 'Help',
    items: [{ label: 'Take the tour', icon: 'i-lucide-compass', onSelect: replay }]
  }])

  return { active, done: computed(() => seen.value.done), start, finish, cancel, replay }
}

export const useAppTour = createAppComposable(_useAppTour)
