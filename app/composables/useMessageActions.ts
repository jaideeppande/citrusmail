import type { ContextMenuItem } from '@nuxt/ui'

// The actions a message offers, shared by its right-click menu and anything
// else that lists them. Right-clicking a ticked row acts on every ticked row
export function useMessageActions(source: () => MessageSummary) {
  const mail = useMail()
  const { kbds } = useShortcutKeys()
  const nudges = useNudges()

  const items = computed<ContextMenuItem[][]>(() => {
    const message = source()
    const list = () => mail.isChecked(message) ? mail.checkedRows.value : [message]
    const many = mail.isChecked(message) && mail.checkedRows.value.length > 1
    const junk = mail.folder.value?.role === 'junk'
    const sent = mail.folder.value?.role === 'sent'
    const unread = mail.threadInfo(message)?.unread ?? message.unread
    const path = `${folderLink(message.folder)}?m=${encodeURIComponent(message.id)}`
    // Folders you made, to move it straight into
    const targets = mail.folders.value.filter(folder => folder.path !== message.folder && folder.role !== 'drafts' && folder.role !== 'sent' && folder.role !== 'flagged')

    return [[{
      label: unread ? 'Mark as read' : 'Mark as unread',
      icon: unread ? 'i-lucide-mail-open' : 'i-lucide-mail',
      kbds: kbds('mail.toggleRead'),
      onSelect: () => mail.setUnreadMany(list(), !unread)
    }, {
      label: message.flagged ? 'Remove flag' : 'Flag',
      icon: 'i-lucide-flag',
      kbds: kbds('mail.flag'),
      onSelect: () => mail.flagMany(list(), !message.flagged)
    }, ...(many
      ? []
      : [{
          label: mail.isPinned(message) ? 'Unpin' : 'Pin to top',
          icon: mail.isPinned(message) ? 'i-lucide-pin-off' : 'i-lucide-pin',
          kbds: kbds('mail.pin'),
          onSelect: () => mail.togglePin(message)
        }]), {
      label: 'Snooze',
      icon: 'i-lucide-alarm-clock',
      children: snoozeItems(list)
    }], [{
      label: 'Archive',
      icon: 'i-lucide-archive',
      kbds: kbds('mail.archive'),
      disabled: mail.folder.value?.role === 'archive',
      onSelect: () => mail.moveMany(list(), 'archive')
    }, {
      label: 'Move to',
      icon: 'i-lucide-folder-input',
      disabled: !targets.length,
      children: targets.map(folder => ({ label: folder.name, icon: folderIcon(folder), onSelect: () => mail.moveMany(list(), folder.path) }))
    }, {
      label: junk ? 'Not junk' : 'Move to Junk',
      icon: junk ? 'i-lucide-inbox' : 'i-lucide-shield-alert',
      onSelect: () => mail.moveMany(list(), junk ? 'inbox' : 'junk')
    }, {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      kbds: kbds('mail.delete').slice(0, 1),
      color: 'error' as const,
      onSelect: () => mail.removeMany(list())
    }], [...(sent && !many && nudges.waitingDays(message) !== undefined
      ? [{ label: 'Follow up', icon: 'i-lucide-reply', onSelect: () => nudges.followUp(message) }]
      : []), {
      label: mail.isChecked(message) ? 'Deselect' : 'Select',
      icon: 'i-lucide-square-check',
      kbds: kbds('mail.select'),
      onSelect: () => mail.check(message)
    }, ...(many
      ? []
      : [{
          label: 'Open in a new window',
          icon: 'i-lucide-picture-in-picture-2',
          onSelect: () => openPopout(path)
        }])]]
  })

  return { items }
}
