import { describe, expect, it } from 'vitest'
import { isTimeZone, nextTimeInZone, zoneCity, zoneOffsetAt, zonedParts, zonedTime, zonesDiffer } from '../app/utils/timezones'

const iso = (date: Date) => date.toISOString()

describe('time zones', () => {
  it('reads the clocks of a zone', () => {
    expect(zonedParts('Asia/Tokyo', new Date('2026-01-01T20:15:00Z'))).toEqual({ year: 2026, month: 1, day: 2, hour: 5, minute: 15 })
    expect(zonedParts('America/New_York', new Date('2026-07-01T03:59:00Z'))).toEqual({ year: 2026, month: 6, day: 30, hour: 23, minute: 59 })
  })

  it('knows the offset on both sides of a clock change', () => {
    expect(zoneOffsetAt('Europe/Lisbon', new Date('2026-01-15T12:00:00Z'))).toBe(0)
    expect(zoneOffsetAt('Europe/Lisbon', new Date('2026-07-15T12:00:00Z'))).toBe(60)
    expect(zoneOffsetAt('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300)
    expect(zoneOffsetAt('Asia/Kolkata', new Date('2026-01-15T12:00:00Z'))).toBe(330)
  })

  it('turns a time on their clocks into a moment', () => {
    expect(iso(zonedTime('Europe/Berlin', 2026, 2, 10, 8, 30))).toBe('2026-02-10T07:30:00.000Z')
    expect(iso(zonedTime('Australia/Sydney', 2026, 1, 5, 8, 30))).toBe('2026-01-04T21:30:00.000Z')
  })

  it('gives their morning today when it is still ahead', () => {
    // 06:00 in Lisbon (summer time)
    expect(iso(nextTimeInZone('Europe/Lisbon', 8, 30, new Date('2026-06-01T05:00:00Z')))).toBe('2026-06-01T07:30:00.000Z')
  })

  it('gives their tomorrow once the morning has passed', () => {
    // 23:40 in Lisbon
    expect(iso(nextTimeInZone('Europe/Lisbon', 8, 30, new Date('2026-06-01T22:40:00Z')))).toBe('2026-06-02T07:30:00.000Z')
    // exactly 08:30 there: not "now", the next one
    expect(iso(nextTimeInZone('Europe/Lisbon', 8, 30, new Date('2026-06-01T07:30:00Z')))).toBe('2026-06-02T07:30:00.000Z')
  })

  it('follows the month and the year over their ends', () => {
    expect(iso(nextTimeInZone('Asia/Tokyo', 8, 30, new Date('2026-12-31T12:00:00Z')))).toBe('2026-12-31T23:30:00.000Z')
    expect(iso(nextTimeInZone('America/Los_Angeles', 8, 30, new Date('2026-02-28T20:00:00Z')))).toBe('2026-03-01T16:30:00.000Z')
  })

  it('handles zones on the half hour', () => {
    // 05:30 in Kolkata
    expect(iso(nextTimeInZone('Asia/Kolkata', 8, 30, new Date('2026-01-01T00:00:00Z')))).toBe('2026-01-01T03:00:00.000Z')
  })

  it('crosses the spring clock change', () => {
    // Lisbon goes to summer time on 29 March 2026 at 01:00 UTC. The evening before:
    expect(iso(nextTimeInZone('Europe/Lisbon', 8, 30, new Date('2026-03-28T20:00:00Z')))).toBe('2026-03-29T07:30:00.000Z')
    // New York springs forward on 8 March 2026. 18:00 the day before:
    expect(iso(nextTimeInZone('America/New_York', 8, 30, new Date('2026-03-07T23:00:00Z')))).toBe('2026-03-08T12:30:00.000Z')
  })

  it('crosses the autumn clock change', () => {
    // Lisbon goes back on 25 October 2026 at 01:00 UTC
    expect(iso(nextTimeInZone('Europe/Lisbon', 8, 30, new Date('2026-10-24T20:00:00Z')))).toBe('2026-10-25T08:30:00.000Z')
    // New York falls back on 1 November 2026
    expect(iso(nextTimeInZone('America/New_York', 8, 30, new Date('2026-10-31T22:00:00Z')))).toBe('2026-11-01T13:30:00.000Z')
  })

  it('lands after the jump for a time the clocks skip, and on the first of a time shown twice', () => {
    // 02:30 doesn't exist in New York on 8 March 2026
    const skipped = zonedTime('America/New_York', 2026, 3, 8, 2, 30)
    expect(skipped.getTime()).toBeGreaterThanOrEqual(new Date('2026-03-08T07:00:00Z').getTime())
    expect(skipped.getTime()).toBeLessThanOrEqual(new Date('2026-03-08T07:30:00Z').getTime())
    // 01:30 happens twice on 1 November 2026: the first is still summer time
    expect(iso(zonedTime('America/New_York', 2026, 11, 1, 1, 30))).toBe('2026-11-01T05:30:00.000Z')
  })

  it('compares zones by the time they show, not by name', () => {
    expect(zonesDiffer('Europe/Berlin', 'Europe/Paris', new Date('2026-06-01T00:00:00Z'))).toBe(false)
    expect(zonesDiffer('Europe/Lisbon', 'Europe/London', new Date('2026-06-01T00:00:00Z'))).toBe(false)
    expect(zonesDiffer('Europe/Lisbon', 'Europe/Madrid', new Date('2026-06-01T00:00:00Z'))).toBe(true)
  })

  it('names a zone by its city and rejects what is not one', () => {
    expect(zoneCity('America/New_York')).toBe('New York')
    expect(zoneCity('UTC')).toBe('UTC')
    expect(isTimeZone('Europe/Lisbon')).toBe(true)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
    expect(isTimeZone(undefined)).toBe(false)
  })
})
