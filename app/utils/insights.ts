// The sums behind Settings → Insights. Everything is worked out from message
// lists the app already has (Inbox and Sent), on this computer; nothing here
// asks the server for anything

export interface InsightDay {
  /** Local midnight */
  date: Date
  received: number
  sent: number
}

export interface InsightSender {
  name: string
  address: string
  count: number
}

export interface Insights {
  received7: number
  received30: number
  sent7: number
  sent30: number
  /** The last 30 days, oldest first, today last */
  days: InsightDay[]
  /** Mail received in each hour of the day (local time), over the 30 days */
  hours: number[]
  /** Who wrote most in the 30 days */
  senders: InsightSender[]
  /** Median time from their message to your first answer, in ms; absent with no answers to go on */
  responseMs?: number
  /** How many answers the median is taken over */
  responses: number
}

const DAY = 86_400_000

/** “Re: Fwd: Lunch ” and “lunch” are the same conversation */
export function normaliseSubject(subject: string): string {
  let value = subject.trim().toLowerCase()
  for (let previous = ''; previous !== value;) {
    previous = value
    value = value.replace(/^(re|fwd?|aw|wg|sv|tr|rv)(\[\d+\])?\s*[:：]\s*/, '')
  }
  return value.replace(/\s+/g, ' ')
}

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Whole days between two local dates, however long a day was (clocks change) */
const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)

/**
 * For each message someone sent you, the time until your first answer: a
 * sent message with the same subject, to them, later on
 */
export function responseTimes(inbox: MessageSummary[], sent: MessageSummary[]): number[] {
  const bySubject = new Map<string, { at: number, from: string }[]>()
  for (const message of inbox) {
    const subject = normaliseSubject(message.subject)
    const at = Date.parse(message.date)
    if (!subject || Number.isNaN(at)) continue
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), { at, from: message.from.address.toLowerCase() }])
  }

  // Their message → the soonest answer to it. Two answers to one message count once
  const first = new Map<string, number>()
  for (const message of sent) {
    const at = Date.parse(message.date)
    const asked = bySubject.get(normaliseSubject(message.subject))
    if (!asked || Number.isNaN(at)) continue
    const to = new Set(message.to.map(person => person.address.toLowerCase()))
    // The latest of theirs before yours is the one you were answering
    const origin = asked.filter(item => item.at < at && to.has(item.from)).sort((a, b) => b.at - a.at)[0]
    if (!origin) continue
    const key = `${origin.from} ${origin.at}`
    const wait = at - origin.at
    if (!first.has(key) || wait < first.get(key)!) first.set(key, wait)
  }
  return [...first.values()]
}

export function computeInsights(inbox: MessageSummary[], sent: MessageSummary[], now = new Date()): Insights {
  const today = startOfDay(now)
  const days: InsightDay[] = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - (29 - i)),
    received: 0,
    sent: 0
  }))
  const hours = Array.from({ length: 24 }, () => 0)
  const senders = new Map<string, InsightSender>()
  let received7 = 0
  let sent7 = 0

  /** How many days ago a message is dated, or undefined outside the 30 days */
  const age = (message: MessageSummary) => {
    const date = new Date(message.date)
    if (Number.isNaN(date.getTime())) return undefined
    const ago = daysBetween(date, now)
    return ago >= 0 && ago < 30 ? { ago, date } : undefined
  }

  for (const message of inbox) {
    const when = age(message)
    if (!when) continue
    days[29 - when.ago]!.received++
    hours[when.date.getHours()]!++
    if (when.ago < 7) received7++
    const address = message.from.address.toLowerCase()
    const sender = senders.get(address)
    if (sender) {
      sender.count++
      sender.name ||= message.from.name ?? ''
    } else {
      senders.set(address, { address, name: message.from.name ?? '', count: 1 })
    }
  }

  for (const message of sent) {
    const when = age(message)
    if (!when) continue
    days[29 - when.ago]!.sent++
    if (when.ago < 7) sent7++
  }

  const waits = responseTimes(inbox, sent)

  return {
    received7,
    received30: days.reduce((sum, day) => sum + day.received, 0),
    sent7,
    sent30: days.reduce((sum, day) => sum + day.sent, 0),
    days,
    hours,
    senders: [...senders.values()].sort((a, b) => b.count - a.count || a.address.localeCompare(b.address)).slice(0, 8),
    responseMs: median(waits),
    responses: waits.length
  }
}

/** 5_400_000 as “1 h 30 min”: two units at most, the way you’d say it */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'Under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`
}

/** A round number at or above `max` for the top of a chart’s scale */
export function niceMax(max: number): number {
  if (max <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(max))
  return [1, 2, 4, 5, 10].map(step => step * power).find(step => step >= max)!
}
