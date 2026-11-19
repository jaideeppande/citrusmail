import { describe, expect, it } from 'vitest'
import { cutFreeSlots, freeSlotAt, freeSlotCount, freeSlotLine, freeSlotsHtml, freeSlotsText, mergeFreeSlots } from '../app/utils/find-time'

const utc = (iso: string) => new Date(`${iso}Z`)
const slot = (start: string, end: string) => ({ start: utc(start), end: utc(end) })

describe('mergeFreeSlots', () => {
  it('puts them in order and runs the touching ones together', () => {
    const merged = mergeFreeSlots([
      slot('2026-11-18T14:00:00', '2026-11-18T15:00:00'),
      slot('2026-11-17T10:30:00', '2026-11-17T11:00:00'),
      slot('2026-11-17T10:00:00', '2026-11-17T10:30:00'),
      slot('2026-11-17T10:15:00', '2026-11-17T10:45:00')
    ])

    expect(merged.map(item => [item.start.toISOString(), item.end.toISOString()])).toEqual([
      ['2026-11-17T10:00:00.000Z', '2026-11-17T11:00:00.000Z'],
      ['2026-11-18T14:00:00.000Z', '2026-11-18T15:00:00.000Z']
    ])
  })

  it('drops a slot with no length and leaves its input alone', () => {
    const input = [slot('2026-11-17T10:00:00', '2026-11-17T10:00:00'), slot('2026-11-17T12:00:00', '2026-11-17T12:30:00')]
    expect(mergeFreeSlots(input)).toHaveLength(1)
    expect(input).toHaveLength(2)
  })
})

describe('freeSlotAt and cutFreeSlots', () => {
  const slots = [slot('2026-11-17T10:00:00', '2026-11-17T11:00:00')]

  it('finds the slot under a moment, the end not included', () => {
    expect(freeSlotAt(slots, utc('2026-11-17T10:45:00'))).toBe(slots[0])
    expect(freeSlotAt(slots, utc('2026-11-17T11:00:00'))).toBeUndefined()
  })

  it('cuts a stretch out of the middle, leaving both sides', () => {
    const left = cutFreeSlots(slots, slot('2026-11-17T10:15:00', '2026-11-17T10:30:00'))
    expect(left.map(item => [item.start.toISOString().slice(11, 16), item.end.toISOString().slice(11, 16)])).toEqual([['10:00', '10:15'], ['10:30', '11:00']])
  })

  it('removes a slot the cut covers whole', () => {
    expect(cutFreeSlots(slots, slot('2026-11-17T09:00:00', '2026-11-17T12:00:00'))).toEqual([])
  })
})

describe('freeSlotLine', () => {
  it('writes the slot in the writer’s zone', () => {
    expect(freeSlotLine(slot('2026-11-17T10:00:00', '2026-11-17T10:30:00'), 'Europe/Lisbon')).toBe('Tue 17 Nov, 10:00 – 10:30 (GMT)')
    expect(freeSlotLine(slot('2026-07-14T09:00:00', '2026-07-14T10:00:00'), 'Europe/Lisbon')).toBe('Tue 14 Jul, 10:00 – 11:00 (GMT+1)')
  })

  it('adds the second zone when there is one', () => {
    expect(freeSlotLine(slot('2026-11-17T10:00:00', '2026-11-17T10:30:00'), 'Europe/Lisbon', 'America/New_York'))
      .toBe('Tue 17 Nov, 10:00 – 10:30 (GMT) · 05:00 – 05:30 (GMT-5)')
    expect(freeSlotLine(slot('2026-11-17T10:00:00', '2026-11-17T10:30:00'), 'Europe/Lisbon', 'Asia/Kolkata'))
      .toBe('Tue 17 Nov, 10:00 – 10:30 (GMT) · 15:30 – 16:00 (GMT+5:30)')
  })

  it('says so when it is another day there', () => {
    expect(freeSlotLine(slot('2026-11-17T16:00:00', '2026-11-17T16:30:00'), 'Europe/Lisbon', 'Asia/Tokyo'))
      .toBe('Tue 17 Nov, 16:00 – 16:30 (GMT) · Wed 18 Nov, 01:00 – 01:30 (GMT+9)')
  })

  it('does not repeat a second zone that is the first', () => {
    expect(freeSlotLine(slot('2026-11-17T10:00:00', '2026-11-17T10:30:00'), 'Europe/Lisbon', 'Europe/Lisbon')).toBe('Tue 17 Nov, 10:00 – 10:30 (GMT)')
  })

  it('uses the offset of the day itself across a clock change', () => {
    // New York the day before and the day after its clocks go forward
    expect(freeSlotLine(slot('2026-03-07T15:00:00', '2026-03-07T16:00:00'), 'America/New_York')).toBe('Sat 7 Mar, 10:00 – 11:00 (GMT-5)')
    expect(freeSlotLine(slot('2026-03-09T14:00:00', '2026-03-09T15:00:00'), 'America/New_York')).toBe('Mon 9 Mar, 10:00 – 11:00 (GMT-4)')
  })
})

describe('the text that goes into a message', () => {
  const slots = [slot('2026-11-18T14:00:00', '2026-11-18T15:00:00'), slot('2026-11-17T10:00:00', '2026-11-17T10:30:00')]

  it('lists them in order as plain text', () => {
    expect(freeSlotsText(slots, 'Europe/Lisbon')).toBe([
      'Here are some times that work for me:',
      '• Tue 17 Nov, 10:00 – 10:30 (GMT)',
      '• Wed 18 Nov, 14:00 – 15:00 (GMT)'
    ].join('\n'))
  })

  it('speaks of one time when there is one', () => {
    expect(freeSlotsText(slots.slice(0, 1), 'Europe/Lisbon')).toBe('Here is a time that works for me:\n• Wed 18 Nov, 14:00 – 15:00 (GMT)')
  })

  it('writes the same as a short list for the composer', () => {
    expect(freeSlotsHtml(slots, 'Europe/Lisbon')).toBe('<p>Here are some times that work for me:</p><ul><li><p>Tue 17 Nov, 10:00 – 10:30 (GMT)</p></li><li><p>Wed 18 Nov, 14:00 – 15:00 (GMT)</p></li></ul><p></p>')
  })

  it('counts them in words', () => {
    expect(freeSlotCount(1)).toBe('1 slot marked')
    expect(freeSlotCount(3)).toBe('3 slots marked')
  })
})
