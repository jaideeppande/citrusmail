import { describe, expect, it } from 'vitest'
import { countReply, hourLabel, nextLocalHour, replySamples, usualReplyHour } from '../app/utils/reply-hours'

const at = (hour: number, day = 1) => new Date(2026, 5, day, hour, 15)

describe('reply hours', () => {
  it('counts each message once', () => {
    let entry = countReply(undefined, 'a', at(9))
    entry = countReply(entry, 'a', at(9))
    entry = countReply(entry, 'b', at(10))
    expect(replySamples(entry)).toBe(2)
    expect(entry.hours[9]).toBe(1)
  })

  it('says nothing until there are five messages', () => {
    let entry = countReply(undefined, '1', at(9))
    for (const key of ['2', '3', '4']) entry = countReply(entry, key, at(9))
    expect(usualReplyHour(entry)).toBeUndefined()
    entry = countReply(entry, '5', at(9))
    expect(usualReplyHour(entry)).toBe(9)
  })

  it('weighs the hours either side', () => {
    let entry = countReply(undefined, 'x', at(22))
    entry = countReply(entry, 'y', at(22))
    for (const [index, hour] of [8, 9, 9, 10].entries()) entry = countReply(entry, `m${index}`, at(hour))
    expect(usualReplyHour(entry)).toBe(9)
  })

  it('wraps round midnight', () => {
    let entry = countReply(undefined, 'a', at(23))
    for (const [index, hour] of [0, 0, 1, 23].entries()) entry = countReply(entry, `n${index}`, at(hour))
    expect(usualReplyHour(entry)).toBe(0)
  })

  it('writes hours as people say them', () => {
    expect(hourLabel(9)).toBe('9 am')
    expect(hourLabel(12)).toBe('noon')
    expect(hourLabel(17)).toBe('5 pm')
    expect(hourLabel(0)).toBe('midnight')
  })

  it('finds the next time the clock shows that hour', () => {
    expect(nextLocalHour(9, new Date(2026, 5, 1, 7, 0)).getDate()).toBe(1)
    expect(nextLocalHour(9, new Date(2026, 5, 1, 8, 58)).getDate()).toBe(2)
    expect(nextLocalHour(9, new Date(2026, 5, 1, 10, 0)).getHours()).toBe(9)
  })
})
