// Conversations. The list endpoint says nothing about which message answers
// which, so a conversation is the messages that share a subject once the
// "Re:" and "Fwd:" in front are taken off, the way most mail programs fall
// back when headers are missing

/** A message's place in the app: ids are only unique within a folder */
export const messageKey = (message: Pick<MessageSummary, 'folder' | 'id'>) => `${message.folder}\0${message.id}`

const PREFIX = /^\s*(?:(?:re|aw|sv|vs|antw|fwd?|wg|tr|rv|enc|odp|r|i)\s*(?:\[\d+\])?\s*[:：]\s*)+/i

/** "RE: Fwd: Q4 budget " and "q4 budget" are the same conversation */
export function threadSubject(subject: string): string {
  return subject.replace(PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export interface Thread {
  /** The newest message, which stands for the conversation in the list */
  head: MessageSummary
  /** Every message in it, oldest first */
  messages: MessageSummary[]
  unread: boolean
  flagged: boolean
  hasAttachments: boolean
}

/**
 * Groups a list (newest first) into conversations, each where its newest
 * message stood. A message with no subject is always on its own
 */
export function groupThreads(messages: MessageSummary[]): Thread[] {
  const threads = new Map<string, Thread>()
  for (const message of messages) {
    const subject = threadSubject(message.subject)
    const key = subject ? `${message.folder}\0${subject}` : messageKey(message)
    const thread = threads.get(key)
    if (!thread) {
      threads.set(key, { head: message, messages: [message], unread: message.unread, flagged: message.flagged, hasAttachments: message.hasAttachments })
      continue
    }
    thread.messages.push(message)
    if (message.date > thread.head.date) thread.head = message
    thread.unread ||= message.unread
    thread.flagged ||= message.flagged
    thread.hasAttachments ||= message.hasAttachments
  }
  for (const thread of threads.values()) thread.messages.sort((a, b) => a.date.localeCompare(b.date))
  return [...threads.values()]
}

/** "Ana, Ben and 2 others" for a conversation's row */
export function threadPeople(thread: Thread, self?: string): string {
  const people = new Map<string, Address>()
  for (const message of thread.messages) people.set(message.from.address.toLowerCase(), message.from)
  // One person keeps their whole name; several are told apart by first names
  if (people.size === 1) return personName(thread.head.from)
  const names: string[] = []
  for (const [address, person] of people) {
    const name = address === self?.toLowerCase() ? 'You' : personName(person).split(/[\s@]/)[0]!
    if (!names.includes(name)) names.push(name)
  }
  if (names.length <= 2) return names.join(', ')
  return `${names[0]}, ${names[1]} and ${names.length - 2} ${names.length === 3 ? 'other' : 'others'}`
}

/* Split inbox ------------------------------------------------------- */

export type InboxTab = 'people' | 'newsletters' | 'notifications' | 'tracked' | 'screen'

const MACHINE = /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|notifications?|notify|alerts?|mailer(?:-daemon)?|postmaster|bounces?|system|automated|auto|billing|invoices?|receipts?|orders?|shipping|security|account|accounts|updates?|status|jobs?|digest)(?:[-+_.][^@]*)?@/i

/** Mail written by a system rather than a person, going by who it says it's from */
export function isMachineSender(address: string): boolean {
  return MACHINE.test(address)
}

/** Which Inbox tab a message belongs under. Mailing lists win over machines */
export function inboxCategory(message: MessageSummary, lists: ReadonlySet<string>): Exclude<InboxTab, 'tracked' | 'screen'> {
  const from = message.from.address.toLowerCase()
  if (lists.has(from)) return 'newsletters'
  return isMachineSender(from) ? 'notifications' : 'people'
}

/* Snooze ------------------------------------------------------------ */

/** The times people snooze to, from now: later today only while there is a later */
export function snoozePresets(now = new Date()) {
  const at = (days: number, hour: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + days)
    date.setHours(hour, 0, 0, 0)
    return date
  }
  const presets: { label: string, icon: string, date: Date }[] = []
  if (now.getHours() < 15) presets.push({ label: 'Later today', icon: 'i-lucide-clock-3', date: new Date(now.getTime() + 3 * 3_600_000) })
  if (now.getHours() < 18) presets.push({ label: 'This evening', icon: 'i-lucide-moon', date: at(0, 19) })
  presets.push({ label: 'Tomorrow morning', icon: 'i-lucide-sunrise', date: at(1, 8) })
  const toMonday = (8 - now.getDay()) % 7 || 7
  if (toMonday > 1) presets.push({ label: 'Next week', icon: 'i-lucide-calendar-arrow-up', date: at(toMonday, 8) })
  return presets
}
