import { addDays } from 'date-fns'

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  isDate: boolean
  zone?: { tzid?: string, component?: unknown } | null
  toJSDate: () => Date
}

/**
 * A time from the file as a moment. ical.js converts UTC times and those
 * whose zone the file describes (a VTIMEZONE). A file that only names a zone
 * ("Europe/Lisbon") leaves the time as a wall clock, which is read in that
 * zone here; with no zone at all it is this computer's own time
 */
function moment(time: WallClock, tzid: unknown): Date {
  const known = time.zone?.tzid === 'UTC' || !!time.zone?.component
  if (time.isDate || known || typeof tzid !== 'string') return time.toJSDate()
  try {
    const utc = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tzid, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(utc))
    const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
    const shown = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
    // How far that zone's clock is from UTC at that moment, taken back off
    return new Date(utc - (shown - utc))
  } catch {
    // Not a zone this computer knows (Outlook's "Romance Standard Time"): its own time is the best guess
    return time.toJSDate()
  }
}

/**
 * Reads the first event of a calendar file (.ics) as an invitation. Times
 * come out as moments, so they show in this computer's own time zone
 */
export async function parseInvite(ics: string): Promise<InviteDetails | undefined> {
  try {
    const { default: ICAL } = await import('ical.js')
    const root = new ICAL.Component(ICAL.parse(ics))
    const component = root.getFirstSubcomponent('vevent')
    if (!component) return undefined
    const event = new ICAL.Event(component)
    if (!event.startDate) return undefined

    const allDay = event.startDate.isDate
    const start = moment(event.startDate, component.getFirstProperty('dtstart')?.getParameter('tzid'))
    let end = event.endDate ? moment(event.endDate, (component.getFirstProperty('dtend') ?? component.getFirstProperty('dtstart'))?.getParameter('tzid')) : start
    // A day with no end is that whole day; a time with none runs an hour
    if (end <= start) end = allDay ? addDays(start, 1) : new Date(start.getTime() + 60 * 60_000)

    const organiser = component.getFirstProperty('organizer')
    const name = organiser?.getParameter('cn')
    const address = String(organiser?.getFirstValue() ?? '').replace(/^mailto:/i, '')

    return {
      title: event.summary?.trim() || 'Invitation',
      start,
      end,
      allDay,
      location: event.location?.trim() || undefined,
      organiser: (typeof name === 'string' && name.trim()) || address || undefined,
      description: event.description?.trim() || undefined
    }
  } catch {
    // Not a calendar file after all, or one too broken to read
    return undefined
  }
}
