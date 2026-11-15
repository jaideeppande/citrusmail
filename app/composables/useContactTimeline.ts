import { addDays, startOfDay } from 'date-fns'

export interface TimelineMessage {
  message: MessageSummary
  direction: 'received' | 'sent'
}

// How much of each there is room for under a contact's details
const MAX_MESSAGES = 8
const MAX_EVENTS = 4
// A contact with a dozen addresses would be a dozen pairs of searches
const MAX_ADDRESSES = 3

async function page(query: Record<string, string>): Promise<MessageSummary[]> {
  try {
    return (await $fetch<MessagePage>('/api/messages', { query })).messages
  } catch {
    // One folder that does not answer should not hide the other
    return []
  }
}

/**
 * The newest mail between you and one person, both ways: their messages in
 * the Inbox and yours to them in Sent. The timeline, meeting prep and the
 * relationship summary all read it this way
 */
export async function mailWith(emails: string[], folders: Folder[], limit: number): Promise<TimelineMessage[]> {
  const addresses = emails.slice(0, MAX_ADDRESSES)
  if (!addresses.length) return []

  const inbox = folders.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
  const sent = folders.find(folder => folder.role === 'sent')?.path

  const [received, written] = await Promise.all([
    Promise.all(addresses.map(address => page({ folder: inbox, from: address }))),
    Promise.all(sent ? addresses.map(address => page({ folder: sent, q: address })) : [])
  ])

  // An address searched twice, or a message matching two addresses, counts once
  const merged = new Map<string, TimelineMessage>()
  for (const message of received.flat()) merged.set(`${message.folder}:${message.id}`, { message, direction: 'received' })
  for (const message of written.flat()) merged.set(`${message.folder}:${message.id}`, { message, direction: 'sent' })

  return [...merged.values()]
    .sort((a, b) => new Date(b.message.date).getTime() - new Date(a.message.date).getTime())
    .slice(0, limit)
}

/**
 * What has passed between you and one person lately: the mail in both
 * directions, and the events that name them. Fetched when a contact is
 * opened, never for the whole list
 */
export function useContactTimeline(contact: MaybeRefOrGetter<Contact>) {
  const { folders } = useMail()
  const { account } = useShell()

  const messages = shallowRef<TimelineMessage[]>([])
  const loading = ref(false)

  // The newest answer wins: a search for the contact left behind may land late
  let run = 0

  async function load() {
    const current = ++run
    const addresses = toValue(contact).emails

    if (!addresses.length) {
      messages.value = []
      loading.value = false
      return
    }

    loading.value = true
    const found = await mailWith(addresses, folders.value, MAX_MESSAGES)
    if (current !== run) return
    messages.value = found
    loading.value = false
  }

  // The events side reads the calendar's own pool, topped up with the weeks
  // either side of today so there is something to find outside the calendar page
  const calendar = account.value?.hasCalendar ? useCalendarEvents() : undefined

  if (calendar) {
    const today = startOfDay(new Date())
    calendar.ensureRange({ start: addDays(today, -14), end: addDays(today, 45) })
  }

  const events = computed<CalendarEvent[]>(() => {
    if (!calendar) return []

    const person = toValue(contact)
    const needles = [person.name, ...person.emails].map(value => value.trim().toLowerCase()).filter(value => value.length > 2)
    if (!needles.length) return []

    const now = Date.now()
    const matching = calendar.events.value.filter((event) => {
      const text = `${event.title}\n${event.description ?? ''}`.toLowerCase()
      return needles.some(needle => text.includes(needle))
    })

    // What is coming first, soonest on top, then what has just been
    const upcoming = matching.filter(event => new Date(event.end).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start))
    const past = matching.filter(event => new Date(event.end).getTime() < now).sort((a, b) => b.start.localeCompare(a.start))

    return [...upcoming, ...past].slice(0, MAX_EVENTS)
  })

  watch(() => toValue(contact).emails.join('\n'), load, { immediate: true })

  // The folder list may still be on its way when the contact opens, and the
  // Sent folder is only known once it is here
  watch(() => folders.value.length > 0, (ready, was) => {
    if (ready && was === false) load()
  })

  return { messages, events, loading, reload: load }
}
