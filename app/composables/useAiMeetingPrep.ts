import type { MeetingPrep } from '~/utils/ai-calendar'
import type { TimelineMessage } from './useContactTimeline'

/** Recent messages that go as one line each, and how many of the newest go whole */
const MAX_MESSAGES = 10
const FULL_BODIES = 3
const BODY_CHARS = 3000
/** Preps kept on this computer, newest first */
const KEEP = 30

/**
 * The words of the newest few messages, fetched without marking them read
 * and cut to what the sender wrote. One that can't be fetched is left out
 */
export async function aiMailBodies(items: TimelineMessage[], count = FULL_BODIES, chars = BODY_CHARS) {
  const cache = useMessageCache()
  const bodies = await Promise.all(items.slice(0, count).map(async ({ message }) => {
    try {
      const { message: detail } = await cache.peek(message.folder, message.id)
      const text = ownWords(messageText(detail))
      return { folder: message.folder, id: message.id, text: text.length > chars ? `${text.slice(0, chars)}\n[…]` : text }
    } catch {
      return undefined
    }
  }))
  return bodies.filter(body => !!body?.text) as { folder: string, id: string, text: string }[]
}

/** A person the prep is about: a contact, or an address written in the event */
export interface PrepPerson {
  name: string
  emails: string[]
  contactId?: string
}

export interface StoredPrep {
  key: string
  at: number
  people: PrepPerson[]
  /** The newest mail with them, to open from the panel */
  recent: { folder: string, id: string, subject: string, date: string, direction: 'received' | 'sent', who: string }[]
  prep: MeetingPrep
}

/**
 * Meeting prep for one event: who is in it (contacts named in its title or
 * notes), the recent mail with them, and from that a short brief of where
 * things stand, what they asked of you and what is still open
 */
export function useAiMeetingPrep(event: MaybeRefOrGetter<CalendarEvent>) {
  const ai = useAiClient()
  const { account } = useShell()
  const { folders } = useMail()
  const { contacts } = useContacts()

  const stored = useAccountPref<StoredPrep[]>('ai-meeting-prep', () => [])
  const busy = ref(false)
  const error = ref('')
  let controller: AbortController | undefined

  const on = computed(() => ai.enabled('meeting-prep'))
  const inReach = computed(() => canPrepare(toValue(event)))
  const key = computed(() => `${toValue(event).id}|${toValue(event).start}`)
  const result = computed(() => stored.value.find(item => item.key === key.value))

  const self = computed(() => [account.value?.email ?? '', ...(account.value?.mailboxes?.map(mailbox => mailbox.email) ?? [])].filter(Boolean))
  const people = computed<PrepPerson[]>(() => {
    const current = toValue(event)
    const known = peopleInEvent(current, contacts.value, self.value)
    return [
      ...known.map(contact => ({ name: contact.name, emails: contact.emails, contactId: contact.id })),
      ...addressesInEvent(current, known, self.value).map(address => ({ name: address, emails: [address] }))
    ]
  })

  async function prepare() {
    if (!on.value || busy.value) return
    const current = toValue(event)
    const who = people.value
    if (!who.length) {
      error.value = 'Nobody in this event is in your contacts. Put their name or address in the title or notes.'
      announce(error.value)
      return
    }
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    busy.value = true
    error.value = ''
    announce('Preparing')
    try {
      if (!folders.value.length) await until(() => folders.value.length > 0).toBe(true, { timeout: 5000 })
      // Each person's own search, newest first across all of them
      const found = (await Promise.all(who.slice(0, 4).map(person => mailWith(person.emails, folders.value, MAX_MESSAGES))))
        .flat()
        .filter((item, index, all) => all.findIndex(other => other.message.folder === item.message.folder && other.message.id === item.message.id) === index)
        .sort((a, b) => Date.parse(b.message.date) - Date.parse(a.message.date))
        .slice(0, MAX_MESSAGES)
      const bodies = await aiMailBodies(found)
      if (mine.signal.aborted) return

      let prep: MeetingPrep
      if (!found.length) {
        prep = { context: `No recent mail with ${who.map(person => person.name).join(', ')} to go on.`, asksOfYou: [], openQuestions: [] }
      } else {
        const answer = await ai.json({
          feature: 'meeting-prep',
          system: MEETING_PREP_SYSTEM,
          prompt: meetingPrepPrompt({ event: current, people: who, messages: found, bodies }),
          maxTokens: 700,
          effort: 'medium',
          signal: mine.signal
        }, meetingPrepSchema)
        prep = meetingPrepResult(answer, found)
      }
      if (mine.signal.aborted) return

      const entry: StoredPrep = {
        key: key.value,
        at: Date.now(),
        people: who,
        recent: found.slice(0, 4).map(({ message, direction }) => ({
          folder: message.folder,
          id: message.id,
          subject: message.subject || '(No subject)',
          date: message.date,
          direction,
          who: direction === 'sent' ? personName(message.to[0]) : personName(message.from)
        })),
        prep
      }
      stored.value = [entry, ...stored.value.filter(item => item.key !== entry.key)].slice(0, KEEP)
      announce('Prep ready')
    } catch (failure) {
      if (mine.signal.aborted || (failure as AiError).code === 'aborted') return
      error.value = (failure as AiError).code === 'limit'
        ? 'Today’s AI limit is reached. Raise it in Settings → AI.'
        : (failure as Error).message || 'The prep couldn’t be written.'
      announce('The prep couldn’t be written', true)
    } finally {
      if (controller === mine) {
        busy.value = false
        controller = undefined
      }
    }
  }

  function cancel() {
    controller?.abort()
    busy.value = false
  }

  if (getCurrentScope()) onScopeDispose(cancel)

  return { on, inReach, people, result, busy, error, prepare, cancel }
}
