const _useShortcutsHelp = () => {
  const isOpen = ref(false)

  defineShortcuts({
    '?': () => (isOpen.value = !isOpen.value)
  })

  return { isOpen, open: () => (isOpen.value = true) }
}

export const useShortcutsHelp = createAppComposable(_useShortcutsHelp)

export const SHORTCUT_GROUPS = [{
  title: 'Mail',
  items: [
    { label: 'New message', keys: ['c'] },
    { label: 'Next / previous message', keys: ['j', 'k'] },
    { label: 'Close message', keys: ['escape'] },
    { label: 'Reply', keys: ['r'] },
    { label: 'Reply all', keys: ['a'] },
    { label: 'Forward', keys: ['f'] },
    { label: 'Archive', keys: ['e'] },
    { label: 'Delete', keys: ['#'] },
    { label: 'Flag', keys: ['s'] },
    { label: 'Mark read / unread', keys: ['shift', 'u'] },
    { label: 'Split or list view', keys: ['shift', 'v'] },
    { label: 'Send', keys: ['meta', 'enter'] },
    { label: 'Search', keys: ['/'] },
    { label: 'Fold sidebar', keys: ['['] },
    { label: 'These shortcuts', keys: ['?'] }
  ]
}, {
  title: 'Calendar',
  items: [
    { label: 'Day, week, month, year', keys: ['d', 'w', 'm', 'y'] },
    { label: 'Today', keys: ['t'] },
    { label: 'Previous / next', keys: ['arrowleft', 'arrowright'] },
    { label: 'New event', keys: ['n'] },
    { label: 'Search events', keys: ['meta', 'k'] }
  ]
}]
