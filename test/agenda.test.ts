import { describe, expect, it } from 'vitest'
import { agendaBlocks, agendaFreeLabel, agendaNote, agendaOrder } from '../app/utils/agenda'

const day = (d: number) => new Date(2026, 10, d)
const event = (id: string, start: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, calendarId: 'work', title: id, start, end: start, ...extra })

describe('agendaBlocks', () => {
  const days = [16, 17, 18, 19, 20, 21].map(day)
  const byDay: Record<number, CalendarEvent[]> = {
    17: [event('late', '2026-11-17T15:00:00'), event('early', '2026-11-17T09:00:00'), event('holiday', '2026-11-17T00:00:00', { allDay: true })],
    20: [event('call', '2026-11-20T11:00:00')]
  }
  const eventsOf = (date: Date) => byDay[date.getDate()] ?? []

  it('lists the busy days with their events, all-day first then by time', () => {
    const blocks = agendaBlocks(days, eventsOf, () => false)
    const first = blocks[1]!
    expect(first.kind).toBe('day')
    expect(first.kind === 'day' && first.events.map(item => item.id)).toEqual(['holiday', 'early', 'late'])
  })

  it('runs consecutive empty days together', () => {
    const blocks = agendaBlocks(days, eventsOf, () => false)
    expect(blocks.map(block => block.kind === 'free' ? `free ${block.from.getDate()}-${block.to.getDate()}` : `day ${block.day.getDate()}`))
      .toEqual(['free 16-16', 'day 17', 'free 18-19', 'day 20', 'free 21-21'])
  })

  it('keeps a held day apart even when it is empty', () => {
    const blocks = agendaBlocks(days, eventsOf, date => date.getDate() === 19)
    expect(blocks.map(block => block.kind === 'free' ? `free ${block.from.getDate()}-${block.to.getDate()}` : `day ${block.day.getDate()}`))
      .toEqual(['free 16-16', 'day 17', 'free 18-18', 'day 19', 'day 20', 'free 21-21'])
  })
})

describe('labels', () => {
  it('says one free day plainly, and a run as a span', () => {
    expect(agendaFreeLabel(day(16), day(16))).toBe('Mon 16 · Nothing planned')
    expect(agendaFreeLabel(day(16), day(18))).toBe('Mon 16 – Wed 18 · free')
    expect(agendaFreeLabel(day(29), new Date(2026, 11, 2))).toBe('Sun 29 – Wed 2 Dec · free')
  })

  it('takes the first line of a description', () => {
    expect(agendaNote('  Room 4\nBring the deck ')).toBe('Room 4')
    expect(agendaNote(undefined)).toBe('')
  })

  it('orders all-day ahead of timed', () => {
    const list = [event('b', '2026-11-17T08:00:00'), event('a', '2026-11-17T00:00:00', { allDay: true })].sort(agendaOrder)
    expect(list.map(item => item.id)).toEqual(['a', 'b'])
  })
})
