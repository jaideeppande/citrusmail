import { describe, expect, it } from 'vitest'
import { patchCalendar, objectToEvents } from '../server/utils/ics'
import { htmlToText } from '../server/utils/sanitize'

const lines = (text: string) => text.replace(/\n/g, '\r\n')
const range = { start: '2026-03-01T00:00:00', end: '2026-04-06T00:00:00' }

describe('editing one occurrence of a series', () => {
  it('measures the edit from where a moved occurrence is shown, so renaming it moves nothing', () => {
    const data = lines(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:x
BEGIN:VEVENT
UID:w1
DTSTAMP:20260101T000000Z
DTSTART:20260302T100000Z
DTEND:20260302T110000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Weekly
END:VEVENT
BEGIN:VEVENT
UID:w1
DTSTAMP:20260101T000000Z
RECURRENCE-ID:20260309T100000Z
DTSTART:20260310T140000Z
DTEND:20260310T153000Z
SUMMARY:Weekly moved
END:VEVENT
END:VCALENDAR`)
    const moved = objectToEvents(data, 'w1', 'c', range, 'UTC').find(event => event.title === 'Weekly moved')!
    const out = patchCalendar(data, moved.id, { ...moved, title: 'Renamed' }, 'UTC')
    expect(out).toContain('DTSTART:20260302T100000Z')
    expect(out).toContain('DTEND:20260302T110000Z')
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(out).not.toContain('Weekly moved')
  })

  it('keeps the TZID of a series whose zone has no VTIMEZONE in the file', () => {
    const data = lines(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:x
BEGIN:VEVENT
UID:n1
DTSTAMP:20260101T000000Z
DTSTART;TZID=America/New_York:20260302T100000
DTEND;TZID=America/New_York:20260302T110000
RRULE:FREQ=WEEKLY;COUNT=5
SUMMARY:NoTZ
END:VEVENT
END:VCALENDAR`)
    const first = objectToEvents(data, 'n1', 'c', range, 'Europe/Berlin')[0]!
    const out = patchCalendar(data, first.id, { ...first, title: 'Renamed' }, 'Europe/Berlin')
    expect(out).toContain('DTSTART;TZID=America/New_York:20260302T100000')
    expect(out).toContain('DTEND;TZID=America/New_York:20260302T110000')
  })
})

describe('a message preview', () => {
  it('survives a character reference past the last code point', () => {
    expect(htmlToText('<p>a&#99999999;b &#65;</p>')).toBe('ab A')
  })
})
