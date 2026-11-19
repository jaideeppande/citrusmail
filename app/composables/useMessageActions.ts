import type { ContextMenuItem } from '@nuxt/ui'

// The actions a message offers, shared by its right-click menu and anything
// else that lists them. Right-clicking a ticked row acts on every ticked row
export function useMessageActions(source: () => MessageSummary) {
  const mail = useMail()
  const { kbds } = useShortcutKeys()
  const nudges = useNudges()
  const labels = useLabels()
  const board = useLaterBoard()
  const priority = useAiPriority()
  const scam = useAiScam()
  const suggested = useAiLabels()
  const tasks = useAiTasks()

  /** What the AI features offer on this message: correcting it, or acting on what they found */
  function aiItems(message: MessageSummary, list: () => MessageSummary[], many: boolean): ContextMenuItem[] {
    const items: ContextMenuItem[] = []
    if (priority.on.value) {
      const current = many ? undefined : priority.rowTag(message)?.kind ?? priority.of(message)?.kind
      items.push({
        label: 'Priority',
        icon: 'i-lucide-sparkles',
        children: [
          { label: 'Not important', icon: 'i-lucide-arrow-down', onSelect: () => list().forEach(item => priority.correct(item, 'fyi')) },
          { type: 'separator' as const },
          ...PRIORITY_KINDS.map(kind => ({
            label: PRIORITY_INFO[kind].label,
            icon: PRIORITY_INFO[kind].icon,
            type: 'checkbox' as const,
            checked: current === kind,
            onSelect: () => list().forEach(item => priority.correct(item, kind))
          }))
        ]
      })
    }
    if (tasks.on.value) {
      items.push({ label: 'Find tasks', icon: 'i-lucide-list-todo', onSelect: () => tasks.extract(list()) })
    }
    if (many) {
      if (suggested.withSuggestions(list()).length) items.push({ label: 'Apply suggested labels', icon: 'i-lucide-sparkles', onSelect: () => suggested.applyAll(list()) })
    } else {
      for (const label of suggested.suggestionsOf(message)) {
        items.push({ label: `Add suggested label “${label.name}”`, icon: 'i-lucide-tag', onSelect: () => suggested.apply(message, label.id) })
      }
      if (scam.warning(message)) items.push({ label: 'This looks safe', icon: 'i-lucide-shield-check', onSelect: () => scam.dismiss(message) })
    }
    return items
  }

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
    const ai = aiItems(message, list, many)

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
    }, {
      label: 'Label',
      icon: 'i-lucide-tag',
      kbds: kbds('mail.label'),
      children: [
        ...labels.labels.value.map(label => ({
          label: label.name,
          type: 'checkbox' as const,
          checked: list().every(item => labels.has(item, label.id)),
          onSelect: (event: Event) => {
            // The menu stays open: several labels are often set in one go
            event.preventDefault()
            labels.toggle(list(), label.id)
          }
        })),
        { label: labels.labels.value.length ? 'New label…' : 'Make a label…', icon: 'i-lucide-plus', onSelect: () => useLabelPicker().pick(list()) }
      ]
    }, {
      label: 'Add to Later',
      icon: 'i-lucide-square-kanban',
      children: LATER_COLUMNS.map(column => ({ label: column.label, icon: column.icon, onSelect: () => board.add(list(), column.id) }))
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
    }], ...(ai.length ? [ai] : []), [...(sent && !many && nudges.waitingDays(message) !== undefined
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
