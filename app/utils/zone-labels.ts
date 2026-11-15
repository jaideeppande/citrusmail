// The calendar's second time zone: what a moment reads as somewhere else.
// Everything goes through `Intl.DateTimeFormat`, which knows every zone's
// rules (summer time, half-hour offsets) without a library. Named `calZone…`
// so nothing here meets the composer's own time zone helpers

// Constructing a formatter costs far more than formatting with it, and the
// week grid asks for two dozen labels a column
const partsFormats = new Map<string, Intl.DateTimeFormat>()

function partsFormat(zone: string): Intl.DateTimeFormat {
  let format = partsFormats.get(zone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    partsFormats.set(zone, format)
  }

  return format
}

export interface CalZoneParts {
  year: number
  /** 1 to 12 */
  month: number
  day: number
  hour: number
  minute: number
  /** “Tue” */
  weekday: string
  /** “Nov” */
  monthName: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The wall clock a moment shows in a zone */
export function calZoneParts(date: Date, zone: string): CalZoneParts {
  const parts: Record<string, string> = {}
  for (const part of partsFormat(zone).formatToParts(date)) {
    parts[part.type] = part.value
  }

  // “Sept” in some engines' en-GB data, where every other month is three letters
  const monthName = (parts.month ?? '').slice(0, 3)

  return {
    year: Number(parts.year),
    month: MONTHS.indexOf(monthName) + 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday ?? '',
    monthName
  }
}

/** Whether the browser knows the zone: a saved one can outlive the data it came from */
export function calZoneValid(zone: string | null | undefined): zone is string {
  if (!zone) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })

    return true
  } catch {
    return false
  }
}

/** The zone this computer is set to */
export function calLocalZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** Minutes ahead of UTC at that moment: 330 for Asia/Kolkata, -300 for New York in winter */
export function calZoneOffset(date: Date, zone: string): number {
  const parts = calZoneParts(date, zone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  // The wall clock carries no seconds, so the moment gives up its own
  const moment = Math.floor(date.getTime() / 60_000) * 60_000

  return Math.round((asUtc - moment) / 60_000)
}

/**
 * The moment a wall clock reading stands for in a zone. A time the clocks skip
 * (02:30 on the night they go forward) lands on the hour after it, and one they
 * repeat takes the first of the two
 */
export function calZoneInstant(zone: string, year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // The offset depends on the moment, which depends on the offset: guessed
  // from the wall clock read as UTC, then corrected once with what that gives
  const first = wall - calZoneOffset(new Date(wall), zone) * 60_000
  const second = wall - calZoneOffset(new Date(first), zone) * 60_000
  const matching = [first, second].filter(moment => moment + calZoneOffset(new Date(moment), zone) * 60_000 === wall)

  return new Date(matching.length ? Math.min(...matching) : Math.max(first, second))
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** “17:30” */
export function calZoneTime(date: Date, zone: string): string {
  const { hour, minute } = calZoneParts(date, zone)

  return `${pad(hour)}:${pad(minute)}`
}

/** “Tue 17 Nov” */
export function calZoneDay(date: Date, zone: string): string {
  const { weekday, day, monthName } = calZoneParts(date, zone)

  return `${weekday} ${day} ${monthName}`
}

/**
 * “GMT”, “GMT-5”, “GMT+5:30”: the offset in force at that moment. Written from
 * the offset itself, since what an engine calls a zone varies from one to the next
 */
export function calZoneName(date: Date, zone: string): string {
  const offset = calZoneOffset(date, zone)
  if (!offset) {
    return 'GMT'
  }

  const hours = Math.floor(Math.abs(offset) / 60)
  const minutes = Math.abs(offset) % 60

  return `GMT${offset < 0 ? '-' : '+'}${hours}${minutes ? `:${pad(minutes)}` : ''}`
}

/**
 * How many calendar days the second zone is ahead of the first at that
 * moment: 1 when it is already tomorrow there, -1 when it is still yesterday
 */
export function calZoneDayShift(date: Date, from: string, to: string): number {
  const a = calZoneParts(date, from)
  const b = calZoneParts(date, to)

  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

/** “New York” from “America/New_York”, the last part of the name read as a place */
export function calZoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
}

// The few a traveller knows by another name than their first letters
const CODES: Record<string, string> = {
  'America/New_York': 'NYC',
  'America/Los_Angeles': 'LA',
  'America/Sao_Paulo': 'SAO',
  'Asia/Hong_Kong': 'HK',
  'Asia/Kolkata': 'IST',
  'UTC': 'UTC',
  'Etc/UTC': 'UTC'
}

/**
 * A few letters to head a column with: “LIS” for Europe/Lisbon, “NYC” for
 * America/New_York. The initials of a name in several words, otherwise its
 * first three letters
 */
export function calZoneCode(zone: string): string {
  const known = CODES[zone]
  if (known) {
    return known
  }

  const words = calZoneCity(zone).split(/[\s-]+/).filter(Boolean)
  const letters = words.length > 1
    ? words.map(word => word.charAt(0)).join('')
    : (words[0] ?? zone)

  return letters.slice(0, 3).toUpperCase()
}

/** “14:05 – 15:00” in a zone, with “+1” after an end that falls on the next day there */
export function calZoneRange(start: Date, end: Date, zone: string): string {
  const from = calZoneParts(start, zone)
  const to = calZoneParts(end, zone)
  const days = Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000)
  // An event ending on the stroke of midnight has not reached the next day
  const next = days > 0 && !(days === 1 && to.hour === 0 && to.minute === 0)

  return `${pad(from.hour)}:${pad(from.minute)} – ${pad(to.hour)}:${pad(to.minute)}${next ? ` +${days}` : ''}`
}

/**
 * The same span as someone in the second zone reads it, headed by the
 * zone's letters and saying so when it is another day there:
 * “NYC 05:00 – 05:30”, “TOK Wed 18 Nov, 00:00 – 00:30”
 */
export function calZoneSecondRange(start: Date, end: Date, local: string, second: string): string {
  const shift = calZoneDayShift(start, local, second)
  const day = shift ? `${calZoneDay(start, second)}, ` : ''

  return `${calZoneCode(second)} ${day}${calZoneRange(start, end, second)}`
}

/**
 * What each hour line of a local day reads in the second zone. The lines are
 * the local hours 1 to 23, given as moments, so a zone half an hour off
 * answers “17:30” and a day the clocks change keeps every line honest
 */
export function calZoneHourLabels(hours: Date[], zone: string): string[] {
  return hours.map(hour => calZoneTime(hour, zone))
}

// Offered first: where most of the people one writes to are
export const CAL_COMMON_ZONES = [
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC'
]

/** Every zone the browser knows, the common ones first and not repeated after */
export function calZoneList(): { common: string[], all: string[] } {
  let known: string[] = []
  try {
    known = Intl.supportedValuesOf('timeZone')
  } catch {
    // An engine without the list still takes the common ones by name
  }

  const common = CAL_COMMON_ZONES.filter(calZoneValid)

  return { common, all: known.filter(zone => !common.includes(zone)) }
}

/** “New York (GMT-5)”, the line a zone takes in the list */
export function calZoneLabel(zone: string, at: Date = new Date()): string {
  return `${calZoneCity(zone)} (${calZoneName(at, zone)})`
}
