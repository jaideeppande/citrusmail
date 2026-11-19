import { CalendarDate, getLocalTimeZone, parseDate, Time, toCalendarDateTime, today } from '@internationalized/date'
import { addDays, differenceInCalendarDays, lightFormat, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

export function toCalendarDate(date: Date): CalendarDate {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function toTime(date: Date): Time {
  return new Time(date.getHours(), date.getMinutes())
}

// `getLocalTimeZone` resolves an `Intl.DateTimeFormat` on every call and the
// month view runs this date math on every scroll frame
let localTimeZone: string | undefined

function timeZone(): string {
  return localTimeZone ??= getLocalTimeZone()
}

export function toDate(date: CalendarDate): Date {
  return date.toDate(timeZone())
}

export function toDateTime(date: CalendarDate, time: Time): Date {
  return toCalendarDateTime(date, time).toDate(timeZone())
}

export function todayDate(): CalendarDate {
  return today(timeZone())
}

// Identifies the local calendar day an event falls on, from the date parts so
// it stays correct across DST and costs less than a formatter
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// The day a grid cell stands for, as the `data-date` a pointer gesture reads
// back off it. `dayKey` is the cheaper bucket key and does not parse back
export function isoDate(date: Date): string {
  return lightFormat(date, 'yyyy-MM-dd')
}

// A drag spends dozens of moves inside one cell, and each one would otherwise
// allocate a `CalendarDate` and convert it back through the timezone
let lastISO: string | undefined
let lastDate: Date | undefined

export function dateFromISO(iso: string): Date {
  if (iso !== lastISO) {
    lastISO = iso
    lastDate = toDate(parseDate(iso))
  }

  return lastDate!
}

// The day under a point, from whichever cell is topmost there. Hit-testing
// live rather than measuring the cells upfront is what lets a drag reach a
// month row the virtualizer only mounted once the pointer got near it
export function dateAtPoint(x: number, y: number): Date | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const iso = (element as HTMLElement).dataset?.date
    if (iso) {
      return dateFromISO(iso)
    }
  }

  return null
}

// Ranges are [start, end) so the end boundary is the first excluded instant
export function weekRange(date: CalendarDate, days = 7): DateRange {
  const start = days === 7 ? startOfWeek(toDate(date), { weekStartsOn: 1 }) : toDate(date)

  return { start, end: addDays(start, days) }
}

// Always 6 rows of 7 days so the grid height never jumps between months
export function monthRange(date: CalendarDate): DateRange {
  const start = startOfWeek(startOfMonth(toDate(date)), { weekStartsOn: 1 })

  return { start, end: addDays(start, 42) }
}

// What the month view fetches and its SSR fallback renders: the grid's six
// weeks plus the rows a tall viewport shows below them, so a refresh paints
// real events all the way down instead of placeholders
export const MONTH_FETCH_WEEKS = 12

export function monthFetchRange(date: CalendarDate): DateRange {
  const { start } = monthRange(date)

  return { start, end: addDays(start, MONTH_FETCH_WEEKS * 7) }
}

// How many days the agenda opens on, and how many more each scroll to its
// end brings in
export const AGENDA_DAYS = 28

export function rangeFor(view: CalendarViewName, date: CalendarDate): DateRange {
  // The year view draws no events, so it fetches the month it was opened on,
  // which then opens warm when it zooms back in
  if (view === 'month' || view === 'year') {
    return monthFetchRange(date)
  }

  // The agenda reads on from its date rather than around it
  if (view === 'agenda') {
    const start = toDate(date)

    return { start, end: addDays(start, AGENDA_DAYS) }
  }

  return weekRange(date, view === 'day' ? 1 : 7)
}

// Where a view of a date lives. The agenda is a view the route knows by name
// like the other four
export function calendarPath(date: CalendarDate, view: CalendarViewName): string {
  return `/calendar/${view}/${date.toString()}`
}

// A list that scrolls through the days (the agenda, the mini calendar in the
// mail sidebar) asks for events in six-week blocks counted from one fixed
// Monday, so two of them looking at the same days ask for the same block and
// the second finds it already there. Well inside the ninety days the server
// answers for
export const EVENT_CHUNK_DAYS = 42
const CHUNK_EPOCH = new Date(2024, 0, 1)

export function eventChunks({ start, end }: DateRange): DateRange[] {
  const first = Math.floor(differenceInCalendarDays(startOfDay(start), CHUNK_EPOCH) / EVENT_CHUNK_DAYS)
  // The end is the first day left out, so a range closing on a block's edge
  // does not reach into the next one
  const last = Math.floor((differenceInCalendarDays(startOfDay(end), CHUNK_EPOCH) - 1) / EVENT_CHUNK_DAYS)

  const chunks: DateRange[] = []
  for (let index = first; index <= Math.max(first, last); index++) {
    const from = addDays(CHUNK_EPOCH, index * EVENT_CHUNK_DAYS)
    chunks.push({ start: from, end: addDays(from, EVENT_CHUNK_DAYS) })
  }

  return chunks
}

export function eachDay({ start, end }: DateRange): Date[] {
  const days: Date[] = []
  for (let day = start; day < end; day = addDays(day, 1)) {
    days.push(day)
  }

  return days
}

// Constructing a formatter costs far more than formatting with it, and these
// run once per event chip and per day cell of every rendered week
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' })
const spokenDateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const fullDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long' })
const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' })
const shortMonthYearFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

export function formatTime(date: Date): string {
  return timeFormat.format(date)
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatDay(date: Date): string {
  return dayFormat.format(date)
}

export function formatFullDate(date: Date): string {
  return fullDateFormat.format(date)
}

// “Tuesday 17 November”, the day as it is read out
export function formatSpokenDate(date: Date): string {
  return spokenDateFormat.format(date).replace(',', '')
}

export function formatWeekday(date: Date): string {
  return weekdayFormat.format(date)
}

export function formatMonth(date: Date): string {
  return monthFormat.format(date)
}

export function formatShortMonth(date: Date): string {
  return shortMonthFormat.format(date)
}

export interface RangeTitle {
  months: string
  year: string
}

export function formatRangeTitle({ start, end }: DateRange): RangeTitle {
  const last = addDays(end, -1)
  const year = String(last.getFullYear())

  if (start.getMonth() === last.getMonth()) {
    return { months: monthFormat.format(start), year }
  }

  const startMonth = (start.getFullYear() !== last.getFullYear() ? shortMonthYearFormat : shortMonthFormat).format(start)
  const endMonth = shortMonthFormat.format(last)

  return { months: `${startMonth} – ${endMonth}`, year }
}
