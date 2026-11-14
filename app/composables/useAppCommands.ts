import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { ShortcutId } from '~/utils/shortcuts'

type Group = CommandPaletteGroup<CommandPaletteItem>

/**
 * The commands every window has: places to go, what to do with the open
 * message, how the window is arranged. Called once, by the layout
 */
export function useAppCommands() {
  const { account } = useShell()
  const mail = useMail()
  const { compose } = useComposer()
  const { contacts } = useContacts()
  const { kbds } = useShortcutKeys()
  const chrome = useWindowChrome()
  const panes = usePanes()
  const { open: openShortcuts } = useShortcutsHelp()
  const colorMode = useColorMode()
  const themeSchedule = useThemeSchedule()
  const triage = useTriage()

  const keys = (id: ShortcutId) => kbds(id).map(value => ({ value, variant: 'soft' as const }))

  useCommands((): Group[] => {
    const message = mail.selected.value
    const groups: Group[] = []

    if (message) {
      groups.push({
        id: 'message',
        label: message.subject || '(No subject)',
        items: [
          { label: 'Archive', icon: 'i-lucide-archive', kbds: keys('mail.archive'), onSelect: () => mail.move(message, 'archive') },
          { label: 'Delete', icon: 'i-lucide-trash-2', kbds: keys('mail.delete'), onSelect: () => mail.remove(message) },
          { label: message.unread ? 'Mark as read' : 'Mark as unread', icon: message.unread ? 'i-lucide-mail-open' : 'i-lucide-mail', kbds: keys('mail.toggleRead'), onSelect: () => mail.setUnread(message, !message.unread) },
          { label: message.flagged ? 'Remove flag' : 'Flag', icon: 'i-lucide-flag', kbds: keys('mail.flag'), onSelect: () => mail.toggleFlag(message) },
          { label: mail.isPinned(message) ? 'Unpin' : 'Pin to top', icon: 'i-lucide-pin', kbds: keys('mail.pin'), onSelect: () => mail.togglePin(message) },
          ...snoozePresets().map(preset => ({ label: `Snooze: ${preset.label.toLowerCase()}`, icon: preset.icon, suffix: snoozeLabel(preset.date), onSelect: () => mail.snooze([message], preset.date) })),
          { label: 'Open in a new window', icon: 'i-lucide-picture-in-picture-2', kbds: keys('window.popout'), onSelect: () => openPopout(`${folderLink(message.folder)}?m=${encodeURIComponent(message.id)}`) }
        ]
      })
    }

    groups.push({
      id: 'actions',
      label: 'Actions',
      items: [
        { label: 'New message', icon: 'i-lucide-square-pen', kbds: keys('mail.compose'), onSelect: () => compose() },
        { label: 'Triage the Inbox', icon: 'i-lucide-list-checks', kbds: keys('mail.triage'), onSelect: () => triage.start() },
        { label: 'Undo the last move or delete', icon: 'i-lucide-undo-2', kbds: keys('mail.undo'), onSelect: () => mail.undo() },
        { label: 'Check for new mail', icon: 'i-lucide-rotate-cw', onSelect: () => mail.refreshTop() }
      ]
    }, {
      id: 'go',
      label: 'Go to',
      items: [
        ...mail.folders.value.map(folder => ({
          label: folder.name,
          icon: folderIcon(folder),
          suffix: folder.unread && folder.role !== 'trash' && folder.role !== 'sent' ? `${folder.unread} unread` : undefined,
          to: folderLink(folder.path)
        })),
        ...(account.value?.hasCalendar ? [{ label: 'Calendar', icon: 'i-lucide-calendar', kbds: keys('go.calendar'), to: `/calendar/week/${todayDate().toString()}` }] : []),
        ...(account.value?.hasContacts ? [{ label: 'Contacts', icon: 'i-lucide-book-user', kbds: keys('go.contacts'), to: '/contacts' }] : []),
        ...(account.value?.protocol !== 'pop3' ? [{ label: 'Subscriptions', icon: 'i-lucide-newspaper', to: '/subscriptions' }] : []),
        { label: 'Settings', icon: 'i-lucide-settings', kbds: keys('go.settings'), to: '/settings' }
      ]
    }, {
      id: 'window',
      label: 'Window',
      items: [
        { label: chrome.focus.value ? 'Leave focus mode' : 'Focus mode', icon: 'i-lucide-focus', kbds: keys('window.focus'), onSelect: () => (chrome.focus.value = !chrome.focus.value) },
        { label: 'Open this page in a new window', icon: 'i-lucide-picture-in-picture-2', onSelect: () => openPopout(currentPath()) },
        ...(panes.available.value
          ? LAYOUTS.map(item => ({ label: `Layout: ${item.label.toLowerCase()}`, icon: item.panes > 1 ? 'i-lucide-layout-grid' : 'i-lucide-square', active: panes.layout.value.id === item.id, onSelect: () => panes.setLayout(item.id) }))
          : []),
        { label: colorMode.value === 'dark' ? 'Switch to light' : 'Switch to dark', icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon', onSelect: () => themeSchedule.schedule.value.on ? themeSchedule.turnOff(colorMode.value === 'dark' ? 'light' : 'dark') : (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark') },
        { label: 'Keyboard shortcuts', icon: 'i-lucide-keyboard', kbds: keys('app.help'), onSelect: openShortcuts }
      ]
    })

    if (contacts.value.length) {
      groups.push({
        id: 'people',
        label: 'Write to',
        // Only shown once something is typed: hundreds of names are no menu
        ignoreFilter: false,
        items: contacts.value.filter(contact => contact.emails.length).slice(0, 400).map(contact => ({
          label: contact.name,
          suffix: contact.emails[0],
          icon: 'i-lucide-user-round',
          onSelect: () => compose([{ name: contact.name, address: contact.emails[0]! }])
        }))
      })
    }

    return groups
  })

  // g then a letter goes places
  const folderOf = (role: FolderRole) => mail.folders.value.find(folder => folder.role === role)?.path
  defineAppShortcuts({
    'go.inbox': () => navigateTo(folderLink('INBOX')),
    'go.drafts': () => navigateTo(folderLink(folderOf('drafts') ?? 'Drafts')),
    'go.sent': () => navigateTo(folderLink(folderOf('sent') ?? 'Sent')),
    'go.calendar': () => account.value?.hasCalendar && navigateTo(`/calendar/week/${todayDate().toString()}`),
    'go.contacts': () => account.value?.hasContacts && navigateTo('/contacts'),
    'go.settings': () => navigateTo('/settings'),
    'window.popout': () => openPopout(currentPath())
  })
}
