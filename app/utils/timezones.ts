// Time in other people's zones, worked out with the browser's own time-zone
// data (Intl) rather than a library. A zone is an IANA name: Europe/Lisbon

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string) {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }))
  }
  return formatters.get(zone)!
}

/** Whether the browser knows this zone */
export function isTimeZone(zone?: string): zone is string {
  if (!zone) return false
  try {
    formatter(zone)
    return true
  } catch {
    return false
  }
}

/** The zone this computer is in */
export function myTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** What the clocks in `zone` show at `date` */
export function zonedParts(zone: string, date: Date): ZonedParts {
  const parts: Record<string, number> = {}
  for (const part of formatter(zone).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return { year: parts.year!, month: parts.month!, day: parts.day!, hour: parts.hour! % 24, minute: parts.minute! }
}

/** Minutes `zone` is ahead of UTC at `date` (behind is negative) */
export function zoneOffsetAt(zone: string, date: Date): number {
  const { year, month, day, hour, minute } = zonedParts(zone, date)
  const shown = Date.UTC(year, month - 1, day, hour, minute)
  return Math.round((shown - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000)
}

/**
 * The moment the clocks in `zone` show this date and time. A time the clocks
 * skip (the hour lost in spring) becomes the same minutes an hour later; one
 * they show twice (autumn) is the first of the two
 */
export function zonedTime(zone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // The offset depends on the moment, which depends on the offset: start
  // from the offset a day earlier (the first of two readings in autumn) and
  // correct once
  const first = wall - zoneOffsetAt(zone, new Date(wall - 86_400_000)) * 60_000
  const offset = zoneOffsetAt(zone, new Date(first))
  const second = wall - offset * 60_000
  // Inside a skipped hour the correction doesn't hold: the first reading stands
  return new Date(zoneOffsetAt(zone, new Date(second)) === offset ? second : first)
}

/**
 * The next time the clocks in `zone` show `hour`:`minute`, at least
 * `margin` minutes from `now`: today there if that is still ahead, otherwise
 * their tomorrow
 */
export function nextTimeInZone(zone: string, hour: number, minute: number, now = new Date(), margin = 1): Date {
  const today = zonedParts(zone, now)
  const earliest = now.getTime() + margin * 60_000
  for (let ahead = 0; ahead < 3; ahead++) {
    // Date.UTC rolls a day past the end of the month into the next one
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + ahead))
    const candidate = zonedTime(zone, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute)
    if (candidate.getTime() >= earliest) return candidate
  }
  return new Date(earliest)
}

/** "Lisbon" from Europe/Lisbon, "New York" from America/New_York */
export function zoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
}

/** "23:40" or "11:40 pm", as this computer writes times, for the clocks in `zone` */
export function clockInZone(zone: string, date = new Date()): string {
  return date.toLocaleTimeString(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' })
}

/** Whether two zones show different times at `date` */
export function zonesDiffer(a: string, b: string, date = new Date()): boolean {
  return zoneOffsetAt(a, date) !== zoneOffsetAt(b, date)
}
