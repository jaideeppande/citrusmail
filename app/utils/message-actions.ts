import { addDays, addMinutes, format, startOfDay } from 'date-fns'

// What a message's text offers to do in one click: put a date on the
// calendar, follow a parcel, copy a phone number or a sign-in code. Only
// things read straight off the text. Links are left alone on purpose: a chip
// saying "Confirm" or "View invoice" would lend a phishing mail the app's voice

export type Carrier = 'UPS' | 'FedEx' | 'DHL' | 'USPS'

export interface DateAction {
  kind: 'date'
  label: string
  start: Date
  end: Date
  allDay: boolean
  /** The words it was read from */
  source: string
}

export interface TrackingAction {
  kind: 'tracking'
  label: string
  carrier: Carrier
  number: string
  url: string
}

export interface PhoneAction {
  kind: 'phone'
  label: string
  number: string
}

export interface CodeAction {
  kind: 'code'
  label: string
  code: string
}

export type MessageAction = DateAction | TrackingAction | PhoneAction | CodeAction

export const MAX_ACTIONS = 4

/* Verification codes ------------------------------------------------ */

const CODE_WORD = '(?:verification|security|confirmation|login|log-in|sign-in|access|one[- ]time|auth(?:entication)?)?\\s*(?:code|passcode|password|otp|pin)'
// "Your code is 123456", "OTP: 4821", "code 123-456"
const CODE_AFTER = new RegExp(`\\b(?:${CODE_WORD}|verification|otp)\\b([^\\n\\d.!?]{0,40}?)(?<![\\w-])(\\d{3}[- ]\\d{3}|\\d{4,8})(?![\\w-])`, 'i')
// Words between "code" and a number that mean the number is something else: "the code review is at 1500 Main Street"
const NOT_A_CODE = /\b(?:at|on|from|until|before|after|review|of)\b/i
// "123456 is your verification code"
const CODE_BEFORE = new RegExp(`(?<![\\w-])(\\d{3}[- ]\\d{3}|\\d{4,8})(?![\\w-])[^\\n\\d]{0,24}\\b(?:is|as) (?:your|the)\\b[^\\n\\d]{0,24}\\b(?:${CODE_WORD}|verification|otp)\\b`, 'i')

export function detectCode(text: string): CodeAction | undefined {
  const after = CODE_AFTER.exec(text)
  const digits = after && !NOT_A_CODE.test(after[1]!) ? after[2] : CODE_BEFORE.exec(text)?.[1]
  if (!digits) return undefined
  const code = digits.replace(/[- ]/g, '')
  return { kind: 'code', label: `Copy code ${code}`, code }
}

/* Tracking numbers --------------------------------------------------- */

const TRACKING_URL: Record<Carrier, (number: string) => string> = {
  UPS: number => `https://www.ups.com/track?tracknum=${number}`,
  FedEx: number => `https://www.fedex.com/fedextrack/?trknbr=${number}`,
  DHL: number => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${number}`,
  USPS: number => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`
}

// UPS and USPS numbers say who they are. FedEx and DHL numbers are plain
// digits, so they only count in a message that names the carrier
const TRACKING: { carrier: Carrier, pattern: RegExp, needs?: RegExp }[] = [
  { carrier: 'UPS', pattern: /\b1Z(?: ?[0-9A-Z]){16}\b/gi },
  { carrier: 'USPS', pattern: /\b9[2-5]\d{2}(?: ?\d{4}){4,5}(?: ?\d{2})?\b/g },
  { carrier: 'USPS', pattern: /\b[A-Z]{2}\d{9}US\b/g },
  { carrier: 'DHL', pattern: /\bJJD\d{16,18}\b|\bJD\d{18}\b/g },
  { carrier: 'FedEx', pattern: /(?<![\d-])(?:\d{4} ?\d{4} ?\d{4}|\d{15}|\d{20})(?![\d-])/g, needs: /\bfedex\b/i },
  { carrier: 'DHL', pattern: /(?<![\d-])\d{10}(?![\d-])/g, needs: /\bdhl\b/i }
]

export function detectTracking(text: string): TrackingAction[] {
  const found = new Map<string, TrackingAction>()
  for (const { carrier, pattern, needs } of TRACKING) {
    if (needs && !needs.test(text)) continue
    for (const match of text.matchAll(pattern)) {
      const number = match[0].replace(/ /g, '').toUpperCase()
      // A longer number found first already covers its digits
      if ([...found.keys()].some(known => known.includes(number))) continue
      found.set(number, { kind: 'tracking', label: `Track with ${carrier}`, carrier, number, url: TRACKING_URL[carrier](encodeURIComponent(number)) })
    }
  }
  return [...found.values()]
}

/* Phone numbers ------------------------------------------------------ */

const PHONE = /(?<![\w/.+-])(\+?\(?\d[\d\s().-]{6,18}\d)(?![\w-])/g
const PHONE_WORD = /\b(?:tel|telephone|phone|call|mobile|cell|whatsapp|fax)\b[^\n\d+]{0,16}$/i

export function detectPhones(text: string): PhoneAction[] {
  const found = new Map<string, PhoneAction>()
  for (const match of text.matchAll(PHONE)) {
    const raw = match[1]!.trim()
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) continue
    // Dates, times and plain long numbers are not phone numbers
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(raw) || raw.includes('\n')) continue
    const international = raw.startsWith('+')
    const grouped = /^\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}$/.test(raw)
    const named = PHONE_WORD.test(text.slice(Math.max(0, match.index - 28), match.index))
    if (!international && !grouped && !named) continue
    const number = raw.replace(/\s+/g, ' ')
    found.set(digits, { kind: 'phone', label: `Copy ${number}`, number })
  }
  return [...found.values()]
}

/* Dates and times ---------------------------------------------------- */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const ORDINAL = '(?:st|nd|rd|th)?'

// "20 November 2026", "November 20th", "2026-11-20", "tomorrow", "next Friday"
const DATE_PATTERNS: { pattern: RegExp, read: (match: RegExpExecArray, now: Date) => Date | undefined }[] = [
  {
    pattern: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    read: match => validDay(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  },
  {
    pattern: new RegExp(`\\b(\\d{1,2})${ORDINAL}(?:\\s+of)?\\s+${MONTH}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'gi'),
    read: (match, now) => monthDay(match[2]!, Number(match[1]), match[3], now)
  },
  {
    pattern: new RegExp(`\\b${MONTH}\\b\\.?\\s+(\\d{1,2})${ORDINAL}(?![\\d:])(?:,?\\s+(\\d{4}))?`, 'gi'),
    read: (match, now) => monthDay(match[1]!, Number(match[2]), match[3], now)
  },
  {
    pattern: /\b(today|tonight|tomorrow)\b/gi,
    read: (match, now) => addDays(startOfDay(now), match[1]!.toLowerCase() === 'tomorrow' ? 1 : 0)
  },
  {
    pattern: /\b(?:(next|this|on)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    read: (match, now) => {
      const target = WEEKDAYS.indexOf(match[2]!.toLowerCase())
      // The coming one; "next Friday" said on a Friday is a week away
      let ahead = (target - now.getDay() + 7) % 7
      if (ahead === 0 && match[1]?.toLowerCase() === 'next') ahead = 7
      return addDays(startOfDay(now), ahead)
    }
  }
]

function validDay(year: number, month: number, day: number): Date | undefined {
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : undefined
}

function monthDay(name: string, day: number, year: string | undefined, now: Date): Date | undefined {
  // "may" in lower case is the verb far more often than the month
  if (name === 'may') return undefined
  const month = MONTHS.indexOf(name.slice(0, 3).toLowerCase())
  if (month === -1) return undefined
  if (year) return validDay(Number(year), month, day)
  const date = validDay(now.getFullYear(), month, day)
  // With no year, a day already behind us means next year's
  return date && date < startOfDay(now) ? validDay(now.getFullYear() + 1, month, day) : date
}

const MERIDIEM = '(a\\.?m\\.?|p\\.?m\\.?)'
// "3pm", "3:30 pm", "3-4pm", "15:00", "15:00–16:30"
const TIME_12 = new RegExp(`\\b(\\d{1,2})(?:[:.](\\d{2}))?\\s?${MERIDIEM}?\\s?(?:-|–|to|until)\\s?(\\d{1,2})(?:[:.](\\d{2}))?\\s?${MERIDIEM}(?![a-z])|\\b(\\d{1,2})(?:[:.](\\d{2}))?\\s?${MERIDIEM}(?![a-z])`, 'i')
const TIME_24 = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b(?:\s?(?:-|–|to|until)\s?([01]?\d|2[0-3])[:h]([0-5]\d)\b)?/i

function hour12(hour: number, meridiem: string): number | undefined {
  if (hour < 1 || hour > 12) return undefined
  const pm = meridiem.toLowerCase().startsWith('p')
  return (hour % 12) + (pm ? 12 : 0)
}

/** A time of day in a few words, as minutes from midnight, with where it ends if it says */
function readTime(words: string): { start: number, end?: number } | undefined {
  const twelve = TIME_12.exec(words)
  if (twelve) {
    if (twelve[4]) {
      const end = hour12(Number(twelve[4]), twelve[6]!)
      // "3-4pm" means both are in the afternoon unless that puts the start after the end
      let start = hour12(Number(twelve[1]), twelve[3] ?? twelve[6]!)
      if (start === undefined || end === undefined) return undefined
      const startMinutes = start * 60 + Number(twelve[2] ?? 0)
      const endMinutes = end * 60 + Number(twelve[5] ?? 0)
      if (!twelve[3] && startMinutes >= endMinutes) start -= 12
      return start < 0 ? undefined : { start: start * 60 + Number(twelve[2] ?? 0), end: endMinutes }
    }
    const hour = hour12(Number(twelve[7]), twelve[9]!)
    return hour === undefined ? undefined : { start: hour * 60 + Number(twelve[8] ?? 0) }
  }
  const day = TIME_24.exec(words)
  if (day) {
    const start = Number(day[1]) * 60 + Number(day[2])
    const end = day[3] ? Number(day[3]) * 60 + Number(day[4]) : undefined
    return { start, end: end !== undefined && end > start ? end : undefined }
  }
  return undefined
}

export function detectDates(text: string, now = new Date()): DateAction[] {
  const hits: { index: number, action: DateAction }[] = []
  const taken: [number, number][] = []

  for (const { pattern, read } of DATE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const from = match.index
      const to = from + match[0].length
      // "Friday 20 November" is one date, read by the more exact pattern first
      if (taken.some(([start, end]) => from < end + 12 && to > start - 12)) continue
      const day = read(match as RegExpExecArray, now)
      if (!day || day < startOfDay(now)) continue
      taken.push([from, to])

      // The time said right after the day ("Friday at 3pm"), else right before it ("3pm on Friday")
      const after = text.slice(to, to + 32).split('\n')[0]!
      const before = text.slice(Math.max(0, from - 24), from).split('\n').at(-1)!
      const time = readTime(after) ?? readTime(before)
      const start = time ? addMinutes(day, time.start) : day
      if (time && start < now) continue
      const end = time ? addMinutes(day, time.end ?? time.start + 60) : addDays(day, 1)
      const when = format(start, time ? 'EEE d MMM, HH:mm' : 'EEE d MMM')
      hits.push({
        index: from,
        action: { kind: 'date', label: `Add to calendar · ${when}`, start, end, allDay: !time, source: text.slice(from, to).trim() }
      })
    }
  }

  // In reading order, one chip per moment
  const seen = new Set<number>()
  return hits.sort((a, b) => a.index - b.index).map(hit => hit.action).filter((action) => {
    if (seen.has(action.start.getTime())) return false
    seen.add(action.start.getTime())
    return true
  })
}

/* Everything together ------------------------------------------------ */

/** The few things worth a chip, most useful first: a code, a parcel, up to two dates, a phone number */
export function detectActions(text: string, now = new Date()): MessageAction[] {
  const sample = text.slice(0, 20_000)
  const code = detectCode(sample)
  const tracking = detectTracking(sample)
  // A parcel number in groups of four reads like a phone number too
  const numbers = [code?.code ?? '', ...tracking.map(item => item.number)]
  const phones = detectPhones(sample).filter(phone => !numbers.some(number => number.includes(phone.number.replace(/\D/g, ''))))
  return [
    ...(code ? [code] : []),
    ...tracking.slice(0, 1),
    ...detectDates(sample, now).slice(0, 2),
    ...phones.slice(0, 1)
  ].slice(0, MAX_ACTIONS)
}
