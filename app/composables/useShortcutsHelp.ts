const _useShortcutsHelp = () => {
  const isOpen = ref(false)

  defineAppShortcuts({ 'app.help': () => (isOpen.value = !isOpen.value) })

  return { isOpen, open: () => (isOpen.value = true) }
}

export const useShortcutsHelp = createAppComposable(_useShortcutsHelp)
