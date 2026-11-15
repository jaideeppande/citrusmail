export type LaterColumn = 'todo' | 'waiting' | 'done'

export interface LaterCard {
  key: string
  column: LaterColumn
  /** The row as it was when it was added, so the board needs no server to draw itself */
  message: MessageSummary
  addedAt: number
  note?: string
}

export const LATER_COLUMNS: { id: LaterColumn, label: string, icon: string, hint: string }[] = [
  { id: 'todo', label: 'To do', icon: 'i-lucide-circle-dashed', hint: 'Mail you need to act on.' },
  { id: 'waiting', label: 'Waiting', icon: 'i-lucide-hourglass', hint: 'Mail you’re waiting on someone else for.' },
  { id: 'done', label: 'Done', icon: 'i-lucide-circle-check', hint: 'Dealt with. Clear it out when you like.' }
]

// The Later board: another way to work through mail, as cards in three
// columns. A card is a pointer to a message, which stays in its folder; the
// board itself is kept on this computer, per mailbox
const _useLaterBoard = () => {
  const cards = useAccountPref<LaterCard[]>('later', () => [])

  const column = (id: LaterColumn) => cards.value.filter(card => card.column === id)
  const open = computed(() => cards.value.filter(card => card.column !== 'done').length)
  const has = (message: MessageSummary) => cards.value.some(card => card.key === labelKey(message))

  function add(messages: MessageSummary[], to: LaterColumn = 'todo') {
    const keys = new Set(messages.map(labelKey))
    cards.value = [
      ...messages.map(message => ({ key: labelKey(message), column: to, message, addedAt: Date.now(), note: cards.value.find(card => card.key === labelKey(message))?.note })),
      ...cards.value.filter(card => !keys.has(card.key))
    ]
    const label = LATER_COLUMNS.find(item => item.id === to)!.label
    announce(messages.length === 1 ? `Added to ${label}` : `${messages.length} added to ${label}`)
  }

  /** Moves a card to a column, in front of the card with key `before` or at the end */
  function move(key: string, to: LaterColumn, before?: string) {
    const card = cards.value.find(item => item.key === key)
    if (!card || key === before) return
    const rest = cards.value.filter(item => item.key !== key)
    const moved = { ...card, column: to }
    const at = before ? rest.findIndex(item => item.key === before) : -1
    if (at === -1) {
      // After the last card of that column, wherever that sits in the list
      const last = rest.map(item => item.column).lastIndexOf(to)
      rest.splice(last === -1 ? rest.length : last + 1, 0, moved)
    } else {
      rest.splice(at, 0, moved)
    }
    cards.value = rest
    if (card.column !== to) announce(`Moved to ${LATER_COLUMNS.find(item => item.id === to)!.label}`)
  }

  function remove(key: string) {
    cards.value = cards.value.filter(card => card.key !== key)
  }

  function setNote(key: string, note: string) {
    cards.value = cards.value.map(card => card.key === key ? { ...card, note: note.trim().slice(0, 200) || undefined } : card)
  }

  function clearDone() {
    cards.value = cards.value.filter(card => card.column !== 'done')
  }

  return { cards, column, open, has, add, move, remove, setNote, clearDone }
}

export const useLaterBoard = createAppComposable(_useLaterBoard)

/** What a dragged card carries: its key */
export const LATER_DRAG_TYPE = 'application/x-citrusmail-later'
