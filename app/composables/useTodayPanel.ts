// The Today panel: your day at a glance, slid over whatever is on screen.
// One for the whole app, opened by its shortcut, the palette or the button
// in the window bar
const _useTodayPanel = () => {
  const isOpen = ref(false)
  const { kbds } = useShortcutKeys()

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  defineAppShortcuts({
    'window.today': toggle
  })

  useCommands(() => [{
    id: 'today',
    label: 'Today',
    items: [{
      label: 'Today',
      suffix: 'Your day at a glance',
      icon: 'i-lucide-sun',
      kbds: kbds('window.today').map(value => ({ value, variant: 'soft' as const })),
      onSelect: open
    }]
  }])

  return { isOpen, toggle, open, close }
}

export const useTodayPanel = createAppComposable(_useTodayPanel)
