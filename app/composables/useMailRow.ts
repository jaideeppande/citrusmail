// What the two kinds of row in the message list share: who it shows, the
// conversation it stands for, its marks, and how it answers a click or a drag
export function useMailRow(props: { message: MessageSummary, selected: boolean, sent?: boolean }) {
  const mail = useMail()
  const { account } = useShell()
  const nudges = useNudges()

  const thread = computed(() => mail.threadInfo(props.message))
  const count = computed(() => thread.value?.messages.length ?? 1)
  const unread = computed(() => thread.value?.unread ?? props.message.unread)
  const flagged = computed(() => thread.value?.flagged ?? props.message.flagged)
  const hasAttachments = computed(() => thread.value?.hasAttachments ?? props.message.hasAttachments)

  const person = computed(() => {
    if (props.sent) return props.message.to.map(personName).join(', ') || 'No recipients'
    return thread.value ? threadPeople(thread.value, account.value?.email) : personName(props.message.from)
  })

  const key = computed(() => messageKey(props.message))
  const checked = computed(() => mail.isChecked(props.message))
  const checking = computed(() => mail.checked.value.size > 0)
  const pinned = computed(() => mail.thread(props.message).some(mail.isPinned))
  const returned = computed(() => mail.thread(props.message).some(mail.isReturned))
  const waiting = computed(() => props.sent ? nudges.waitingDays(props.message) : undefined)
  const labelled = computed(() => useLabels().labelsOf(props.message).length > 0)

  const motion = computed(() => mail.vanishing.value.has(key.value) ? 'lb-row-leaving' : mail.arrived.value.has(key.value) ? 'lb-row-arriving' : '')

  // Ctrl or Command ticks it, Shift ticks everything up to it, as in a file
  // manager; a plain click opens it, or ticks it while others already are
  function onClick(event: MouseEvent) {
    if (event.shiftKey) return mail.check(props.message, true)
    if (event.metaKey || event.ctrlKey || checking.value) return mail.check(props.message)
    mail.select(props.message)
  }

  function onCheck(event: MouseEvent) {
    mail.check(props.message, event.shiftKey)
  }

  // Dragged onto a folder in the sidebar: this row, or every ticked row when it is one of them
  function onDragStart(event: DragEvent) {
    const rows = checked.value ? mail.checkedRows.value : [props.message]
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(MAIL_DRAG_TYPE, JSON.stringify(rows.map(messageKey)))
    const ghost = document.createElement('div')
    ghost.className = 'lb-drag-ghost'
    ghost.textContent = rows.length === 1 ? (props.message.subject || '(No subject)') : `${rows.length} conversations`
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(ghost, 12, 12)
    setTimeout(() => ghost.remove())
  }

  return { thread, count, unread, flagged, hasAttachments, person, checked, checking, pinned, returned, waiting, labelled, motion, onClick, onCheck, onDragStart }
}

/** What a dragged row carries: the keys of the messages, as JSON */
export const MAIL_DRAG_TYPE = 'application/x-citrusmail-messages'
