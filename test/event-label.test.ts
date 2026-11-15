import { describe, expect, it } from 'vitest'
import { eventLabel } from '../app/utils/event-label'

describe('eventLabel', () => {
  it('says a timed event in full', () => {
    expect(eventLabel({ title: 'Budget review', start: '2026-11-17T15:00:00', end: '2026-11-17T16:00:00' }, 'Work'))
      .toBe('Budget review, Tuesday 17 November, 15:00 to 16:00, Work calendar')
  })

  it('keeps an event ending at midnight on its own day', () => {
    expect(eventLabel({ title: 'Party', start: '2026-11-17T21:00:00', end: '2026-11-18T00:00:00' }))
      .toBe('Party, Tuesday 17 November, 21:00 to 00:00')
  })

  it('names both days of a timed event running past midnight', () => {
    expect(eventLabel({ title: 'Night shift', start: '2026-11-17T22:00:00', end: '2026-11-18T06:00:00' }))
      .toBe('Night shift, Tuesday 17 November 22:00 to Wednesday 18 November 06:00')
  })

  it('says all day, and the span of a multi-day event', () => {
    expect(eventLabel({ title: 'Holiday', start: '2026-11-17T00:00:00', end: '2026-11-18T00:00:00', allDay: true }, 'Home'))
      .toBe('Holiday, Tuesday 17 November, all day, Home calendar')
    expect(eventLabel({ title: 'Conference', start: '2026-11-17T00:00:00', end: '2026-11-20T00:00:00', allDay: true }))
      .toBe('Conference, Tuesday 17 November to Thursday 19 November, all day')
  })

  it('says when it repeats, and stands in for a missing title', () => {
    expect(eventLabel({ title: '', start: '2026-11-17T09:00:00', end: '2026-11-17T09:15:00', recurring: true }))
      .toBe('Untitled event, Tuesday 17 November, 09:00 to 09:15, repeats')
  })
})
