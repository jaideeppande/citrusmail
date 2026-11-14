/** An event as the Today panel lists it: where it stands against the clock */
interface AgendaItem {
  event: CalendarEvent
  start: Date
  end: Date
  /** `now` is under way, `next` is the first one still to start */
  state: 'past' | 'now' | 'next' | 'later'
  /** The countdown the two emphasised ones carry: “in 25 min”, “ends in 10 min” */
  note?: string
}
