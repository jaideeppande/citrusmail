import { describe, expect, it } from 'vitest'
import {
  calZoneCity,
  calZoneCode,
  calZoneDay,
  calZoneDayShift,
  calZoneHourLabels,
  calZoneInstant,
  calZoneList,
  calZoneName,
  calZoneOffset,
  calZoneParts,
  calZoneRange,
  calZoneSecondRange,
  calZoneTime,
  calZoneValid
} from '../app/utils/zone-labels'

const utc = (iso: string) => new Date(`${iso}Z`)

describe('calZoneTime', () => {
  it('reads a moment on another wall clock', () => {
    expect(calZoneTime(utc('2026-11-17T10:00:00'), 'Europe/Lisbon')).toBe('10:00')
    expect(calZoneTime(utc('2026-11-17T10:00:00'), 'America/New_York')).toBe('05:00')
    expect(calZoneTime(utc('2026-11-17T10:00:00'), 'Asia/Tokyo')).toBe('19:00')
  })

  it('keeps the half hour of a zone that has one', () => {
    expect(calZoneTime(utc('2026-11-17T12:00:00'), 'Asia/Kolkata')).toBe('17:30')
    expect(calZoneTime(utc('2026-11-17T18:45:00'), 'Asia/Kolkata')).toBe('00:15')
    // And the three quarters of Nepal
    expect(calZoneTime(utc('2026-11-17T12:00:00'), 'Asia/Kathmandu')).toBe('17:45')
  })

  it('writes midnight as 00, never 24', () => {
    expect(calZoneTime(utc('2026-11-17T00:00:00'), 'UTC')).toBe('00:00')
  })
})

describe('summer time', () => {
  it('follows New York across the night the clocks go forward', () => {
    // 8 March 2026: 02:00 EST becomes 03:00 EDT at 07:00 UTC
    expect(calZoneTime(utc('2026-03-08T06:30:00'), 'America/New_York')).toBe('01:30')
    expect(calZoneTime(utc('2026-03-08T07:30:00'), 'America/New_York')).toBe('03:30')
    expect(calZoneOffset(utc('2026-03-08T06:30:00'), 'America/New_York')).toBe(-300)
    expect(calZoneOffset(utc('2026-03-08T07:30:00'), 'America/New_York')).toBe(-240)
  })

  it('follows it back in the autumn', () => {
    // 1 November 2026: 02:00 EDT becomes 01:00 EST at 06:00 UTC
    expect(calZoneTime(utc('2026-11-01T05:30:00'), 'America/New_York')).toBe('01:30')
    expect(calZoneTime(utc('2026-11-01T06:30:00'), 'America/New_York')).toBe('01:30')
    expect(calZoneName(utc('2026-11-01T05:30:00'), 'America/New_York')).toBe('GMT-4')
    expect(calZoneName(utc('2026-11-01T06:30:00'), 'America/New_York')).toBe('GMT-5')
  })

  it('knows the weeks Lisbon and New York are an hour closer', () => {
    // The US changes on 8 March, Europe on 29 March: four hours apart between
    const before = utc('2026-03-02T12:00:00')
    const between = utc('2026-03-16T12:00:00')
    const after = utc('2026-03-30T12:00:00')
    const gap = (date: Date) => calZoneOffset(date, 'Europe/Lisbon') - calZoneOffset(date, 'America/New_York')

    expect(gap(before)).toBe(300)
    expect(gap(between)).toBe(240)
    expect(gap(after)).toBe(300)
  })

  it('names the offset in force', () => {
    expect(calZoneName(utc('2026-01-15T12:00:00'), 'Europe/Lisbon')).toBe('GMT')
    expect(calZoneName(utc('2026-07-15T12:00:00'), 'Europe/Lisbon')).toBe('GMT+1')
    expect(calZoneName(utc('2026-07-15T12:00:00'), 'Asia/Kolkata')).toBe('GMT+5:30')
    expect(calZoneName(utc('2026-07-15T12:00:00'), 'UTC')).toBe('GMT')
  })
})

describe('calZoneInstant', () => {
  it('turns a wall clock reading into its moment', () => {
    expect(calZoneInstant('Asia/Kolkata', 2026, 11, 17, 17, 30).toISOString()).toBe('2026-11-17T12:00:00.000Z')
    expect(calZoneInstant('America/New_York', 2026, 7, 4, 9, 0).toISOString()).toBe('2026-07-04T13:00:00.000Z')
    expect(calZoneInstant('America/New_York', 2026, 12, 4, 9, 0).toISOString()).toBe('2026-12-04T14:00:00.000Z')
  })

  it('lands a skipped time on the hour after it', () => {
    // 02:30 does not exist in New York on 8 March 2026
    const moment = calZoneInstant('America/New_York', 2026, 3, 8, 2, 30)
    expect(calZoneTime(moment, 'America/New_York')).toBe('03:30')
  })

  it('takes the first of a repeated time', () => {
    const moment = calZoneInstant('America/New_York', 2026, 11, 1, 1, 30)
    expect(moment.toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })

  it('round-trips through the parts', () => {
    for (const zone of ['Europe/Lisbon', 'Asia/Kolkata', 'Australia/Lord_Howe', 'Pacific/Auckland']) {
      const moment = calZoneInstant(zone, 2026, 6, 15, 8, 45)
      const parts = calZoneParts(moment, zone)
      expect([parts.year, parts.month, parts.day, parts.hour, parts.minute]).toEqual([2026, 6, 15, 8, 45])
    }
  })
})

describe('days', () => {
  it('says when it is already tomorrow, or still yesterday, over there', () => {
    const evening = utc('2026-11-17T20:00:00')
    expect(calZoneDayShift(evening, 'Europe/Lisbon', 'Asia/Tokyo')).toBe(1)
    expect(calZoneDayShift(evening, 'Asia/Tokyo', 'Europe/Lisbon')).toBe(-1)
    expect(calZoneDayShift(evening, 'Europe/Lisbon', 'America/New_York')).toBe(0)
    // Across the turn of a year
    expect(calZoneDayShift(utc('2026-12-31T23:30:00'), 'UTC', 'Asia/Kolkata')).toBe(1)
  })

  it('writes the day as the zone has it', () => {
    expect(calZoneDay(utc('2026-11-17T20:00:00'), 'Europe/Lisbon')).toBe('Tue 17 Nov')
    expect(calZoneDay(utc('2026-11-17T20:00:00'), 'Asia/Tokyo')).toBe('Wed 18 Nov')
    expect(calZoneDay(utc('2026-09-01T12:00:00'), 'UTC')).toBe('Tue 1 Sep')
  })
})

describe('ranges', () => {
  it('writes a span on the zone’s clock', () => {
    expect(calZoneRange(utc('2026-11-17T10:00:00'), utc('2026-11-17T10:30:00'), 'America/New_York')).toBe('05:00 – 05:30')
    expect(calZoneRange(utc('2026-11-17T10:00:00'), utc('2026-11-17T10:30:00'), 'Asia/Kolkata')).toBe('15:30 – 16:00')
  })

  it('marks an end that falls on the next day there', () => {
    expect(calZoneRange(utc('2026-11-17T18:00:00'), utc('2026-11-17T19:00:00'), 'Asia/Kolkata')).toBe('23:30 – 00:30 +1')
    // Ending on the stroke of midnight is still that day
    expect(calZoneRange(utc('2026-11-17T23:00:00'), utc('2026-11-18T00:00:00'), 'UTC')).toBe('23:00 – 00:00')
  })

  it('heads the second zone with its letters, and its day when that differs', () => {
    const start = utc('2026-11-17T10:00:00')
    const end = utc('2026-11-17T10:30:00')
    expect(calZoneSecondRange(start, end, 'Europe/Lisbon', 'America/New_York')).toBe('NYC 05:00 – 05:30')

    const late = utc('2026-11-17T15:00:00')
    expect(calZoneSecondRange(late, utc('2026-11-17T15:30:00'), 'Europe/Lisbon', 'Asia/Tokyo')).toBe('TOK Wed 18 Nov, 00:00 – 00:30')
  })
})

describe('hour labels', () => {
  it('reads each hour line in the second zone, half hours included', () => {
    const hours = [9, 10, 11].map(hour => calZoneInstant('Europe/Lisbon', 2026, 11, 17, hour))
    expect(calZoneHourLabels(hours, 'America/New_York')).toEqual(['04:00', '05:00', '06:00'])
    expect(calZoneHourLabels(hours, 'Asia/Kolkata')).toEqual(['14:30', '15:30', '16:30'])
  })

  it('skips the hour the second zone loses', () => {
    // Lisbon hours 6 to 9 on 8 March 2026, while New York goes from 01 to 03
    const hours = [6, 7, 8].map(hour => calZoneInstant('Europe/Lisbon', 2026, 3, 8, hour))
    expect(calZoneHourLabels(hours, 'America/New_York')).toEqual(['01:00', '03:00', '04:00'])
  })
})

describe('names', () => {
  it('reads the place out of a zone name', () => {
    expect(calZoneCity('America/New_York')).toBe('New York')
    expect(calZoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(calZoneCity('UTC')).toBe('UTC')
  })

  it('makes a few letters to head a column with', () => {
    expect(calZoneCode('Europe/Lisbon')).toBe('LIS')
    expect(calZoneCode('America/New_York')).toBe('NYC')
    expect(calZoneCode('Europe/London')).toBe('LON')
    expect(calZoneCode('America/Argentina/Buenos_Aires')).toBe('BA')
    expect(calZoneCode('Asia/Ho_Chi_Minh')).toBe('HCM')
    expect(calZoneCode('America/Port-au-Prince')).toBe('PAP')
    expect(calZoneCode('UTC')).toBe('UTC')
  })

  it('tells a zone the browser knows from one it does not', () => {
    expect(calZoneValid('Asia/Kolkata')).toBe(true)
    expect(calZoneValid('Mars/Olympus_Mons')).toBe(false)
    expect(calZoneValid('')).toBe(false)
  })

  it('lists the common zones first and never twice', () => {
    const { common, all } = calZoneList()
    expect(common[0]).toBe('Europe/London')
    expect(all.some(zone => common.includes(zone))).toBe(false)
    expect(all.length).toBeGreaterThan(100)
  })
})
