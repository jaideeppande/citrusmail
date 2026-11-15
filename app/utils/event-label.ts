import { addDays, isSameDay } from 'date-fns'
import { formatSpokenDate, formatTime } from './dates'

// What a screen reader hears for an event on the grid, said in full: the
// chips and blocks show a title and a time at most, and a colour stands for
// the calendar. “Budget review, Tuesday 17 November, 15:00 to 16:00, Work calendar”
export function eventLabel(event: Pick<CalendarEvent, 'title' | 'start' | 'end' | 'allDay' | 'recurring'>, calendarName?: string): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const parts = [event.title || 'Untitled event']

  if (event.allDay) {
    // The end is the first day it no longer covers
    const last = addDays(end, -1)

    parts.push(last > start && !isSameDay(last, start)
      ? `${formatSpokenDate(start)} to ${formatSpokenDate(last)}, all day`
      : `${formatSpokenDate(start)}, all day`)
  } else if (isSameDay(start, end) || (end.getHours() === 0 && end.getMinutes() === 0 && isSameDay(addDays(end, -1), start))) {
    parts.push(formatSpokenDate(start), `${formatTime(start)} to ${formatTime(end)}`)
  } else {
    parts.push(`${formatSpokenDate(start)} ${formatTime(start)} to ${formatSpokenDate(end)} ${formatTime(end)}`)
  }

  if (calendarName) {
    parts.push(`${calendarName} calendar`)
  }

  if (event.recurring) {
    parts.push('repeats')
  }

  return parts.join(', ')
}
