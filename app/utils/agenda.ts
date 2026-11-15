import { addDays, format, isSameDay, isToday } from 'date-fns'

// The agenda's list: each day with something on it, and the empty ones run
// together into one quiet line so a free week does not take a screen

export type AgendaBlock
  = | { kind: 'day', day: Date, events: CalendarEvent[] }
    | { kind: 'free', from: Date, to: Date }

// All-day events lead the day, the rest follow the clock
export function agendaOrder(a: CalendarEvent, b: CalendarEvent): number {
  return Number(!!b.allDay) - Number(!!a.allDay) || new Date(a.start).getTime() - new Date(b.start).getTime()
}

/**
 * Days in order, each with its events; a run of empty days becomes one block.
 * `keep` holds a day out of any run, empty or not (today, the one a draft is
 * on), so it always has a place of its own
 */
export function agendaBlocks(days: Date[], eventsOf: (day: Date) => CalendarEvent[], keep: (day: Date) => boolean = isToday): AgendaBlock[] {
  const blocks: AgendaBlock[] = []

  for (const day of days) {
    const events = [...eventsOf(day)].sort(agendaOrder)

    if (events.length || keep(day)) {
      blocks.push({ kind: 'day', day, events })
      continue
    }

    const last = blocks.at(-1)
    if (last?.kind === 'free' && isSameDay(addDays(last.to, 1), day)) {
      last.to = day
    } else {
      blocks.push({ kind: 'free', from: day, to: day })
    }
  }

  return blocks
}

/** “Mon 16 · Nothing planned”, or “Mon 16 – Wed 18 · free” for a run of days */
export function agendaFreeLabel(from: Date, to: Date): string {
  const day = (date: Date) => format(date, 'EEE d')

  if (isSameDay(from, to)) {
    return `${day(from)} · Nothing planned`
  }

  // The month joins in once the run crosses into another one
  const end = from.getMonth() === to.getMonth() ? day(to) : format(to, 'EEE d MMM')

  return `${day(from)} – ${end} · free`
}

/** The first line of a description, the one a row has room for */
export function agendaNote(description?: string): string {
  return description?.trim().split(/\n/)[0]?.trim() ?? ''
}
