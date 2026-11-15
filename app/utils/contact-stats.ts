import { median, normaliseSubject } from './insights'

// The sums behind Contacts → Relationships: who you are in touch with, who
// is waiting on whom, who has gone quiet. Worked out on this computer from
// the Inbox and Sent lists the app already reads; nothing here asks the
// server for anything

export interface PersonStats {
  /** Lowercased; the first address of the contact when one person has several */
  address: string
  name: string
  /** Messages from them in the Inbox */
  received: number
  /** Messages you sent them */
  sent: number
  total: number
  /** ms since epoch */
  lastReceived?: number
  lastSent?: number
  /** The later of the two */
  last: number
  /** Median time they take to answer you, in ms; absent with no answers to go on */
  theirReplyMs?: number
  theirReplies: number
  /** Median time you take to answer them */
  yourReplyMs?: number
  yourReplies: number
}

export interface Relationships {
  /** Everyone who counts as a person, most messages first */
  people: PersonStats[]
  mostInTouch: PersonStats[]
  /** Their latest message is newer than yours and has waited more than two days */
  oweReply: PersonStats[]
  /** The reverse: you wrote last, more than two days ago */
  waiting: PersonStats[]
  /** At least five messages between you, none for sixty days */
  lostTouch: PersonStats[]
}

export interface RelationshipOptions {
  /** Your own addresses: mail to yourself is nobody's relationship */
  self: string[]
  now?: number
  /** Folds a contact's several addresses into one; given a lowercased address */
  canonical?: (address: string) => string
  /** Someone in the address book counts even if you never wrote to them */
  known?: (address: string) => boolean
}

const DAY = 86_400_000

export const REPLY_AFTER_DAYS = 2
export const LOST_AFTER_DAYS = 60
export const LOST_MIN_MESSAGES = 5
const TOP = 10
// Two messages with the same subject months apart are not question and answer
const MAX_REPLY_GAP = 30 * DAY

/** Machines that write to everyone and read nothing back */
export function isAutomated(address: string): boolean {
  return /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster|bounces?|notifications?|notify)([+\-_.][^@]*)?@/i.test(address.trim())
}

interface Exchange {
  at: number
  direction: 'received' | 'sent'
}

/**
 * How long each side took to answer, for one person. Within a conversation
 * (the same subject, whatever its Re: and Fwd:), every time the direction
 * turns, the wait is from the latest message before the turn to the first
 * one after it
 */
export function replyTimes(exchanges: Exchange[]): { theirs: number[], yours: number[] } {
  const theirs: number[] = []
  const yours: number[] = []
  const sorted = [...exchanges].sort((a, b) => a.at - b.at)

  for (let index = 1; index < sorted.length; index++) {
    const before = sorted[index - 1]!
    const after = sorted[index]!
    const wait = after.at - before.at
    if (before.direction === after.direction || wait <= 0 || wait > MAX_REPLY_GAP) continue
    if (after.direction === 'sent') yours.push(wait)
    else theirs.push(wait)
  }

  return { theirs, yours }
}

export function computeRelationships(inbox: MessageSummary[], sent: MessageSummary[], options: RelationshipOptions): Relationships {
  const now = options.now ?? Date.now()
  const self = new Set(options.self.map(address => address.trim().toLowerCase()))
  const canonical = options.canonical ?? ((address: string) => address)
  const known = options.known ?? (() => false)

  const people = new Map<string, PersonStats>()
  /** Per person, per conversation: what went back and forth */
  const threads = new Map<string, Map<string, Exchange[]>>()

  function note(person: Address, direction: Exchange['direction'], message: MessageSummary) {
    const raw = person.address?.trim().toLowerCase()
    const at = Date.parse(message.date)
    if (!raw || self.has(raw) || Number.isNaN(at)) return

    const address = canonical(raw)
    const stats = people.get(address) ?? { address, name: '', received: 0, sent: 0, total: 0, last: 0, theirReplies: 0, yourReplies: 0 }
    stats.name ||= person.name?.trim() ?? ''
    stats.total++
    stats.last = Math.max(stats.last, at)
    if (direction === 'received') {
      stats.received++
      stats.lastReceived = Math.max(stats.lastReceived ?? 0, at)
    } else {
      stats.sent++
      stats.lastSent = Math.max(stats.lastSent ?? 0, at)
    }
    people.set(address, stats)

    const subject = normaliseSubject(message.subject)
    // Mail with no subject would all land in one conversation
    if (!subject) return
    const own = threads.get(address) ?? new Map<string, Exchange[]>()
    own.set(subject, [...(own.get(subject) ?? []), { at, direction }])
    threads.set(address, own)
  }

  for (const message of inbox) note(message.from, 'received', message)
  for (const message of sent) {
    // Two addresses of one contact on the same message are one message to them
    const seen = new Set<string>()
    for (const person of message.to) {
      const key = canonical(person.address?.trim().toLowerCase() ?? '')
      if (seen.has(key)) continue
      seen.add(key)
      note(person, 'sent', message)
    }
  }

  for (const [address, own] of threads) {
    const stats = people.get(address)!
    const waits = [...own.values()].map(replyTimes)
    const theirs = waits.flatMap(wait => wait.theirs)
    const yours = waits.flatMap(wait => wait.yours)
    stats.theirReplyMs = median(theirs)
    stats.theirReplies = theirs.length
    stats.yourReplyMs = median(yours)
    stats.yourReplies = yours.length
  }

  // A person is someone you have written to, or keep in your address book:
  // a newsletter is neither, however often it comes
  const counted = [...people.values()]
    .filter(person => !isAutomated(person.address) && (person.sent > 0 || known(person.address)))
    .sort((a, b) => b.total - a.total || b.last - a.last)

  const quietFor = (at: number) => (now - at) / DAY

  return {
    people: counted,
    mostInTouch: counted.slice(0, TOP),
    oweReply: counted
      .filter(person => person.lastReceived !== undefined && person.lastReceived > (person.lastSent ?? 0) && quietFor(person.lastReceived) > REPLY_AFTER_DAYS)
      .sort((a, b) => b.lastReceived! - a.lastReceived!)
      .slice(0, TOP),
    waiting: counted
      .filter(person => person.lastSent !== undefined && person.lastSent > (person.lastReceived ?? 0) && quietFor(person.lastSent) > REPLY_AFTER_DAYS)
      .sort((a, b) => b.lastSent! - a.lastSent!)
      .slice(0, TOP),
    lostTouch: counted
      .filter(person => person.total >= LOST_MIN_MESSAGES && quietFor(person.last) > LOST_AFTER_DAYS)
      .slice(0, TOP)
  }
}

/** “40 min”, “3 h”, “2 days”: a wait, to the nearest unit worth saying */
export function formatWait(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

/** “today”, “yesterday”, “12 days ago”, “3 months ago” */
export function formatAgo(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / DAY)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days} days ago`
  const months = Math.round(days / 30)
  return months < 12 ? `${months} months ago` : months < 18 ? 'a year ago' : `${Math.round(months / 12)} years ago`
}
