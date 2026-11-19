import { describe, expect, it } from 'vitest'
import { computeRelationships, formatAgo, formatWait, isAutomated, replyTimes } from '../app/utils/contact-stats'

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = Date.UTC(2026, 10, 15, 12)

let next = 0
function message(from: string, to: string[], at: number, subject = 'Hello'): MessageSummary {
  return {
    id: String(++next),
    folder: 'INBOX',
    subject,
    from: { address: from },
    to: to.map(address => ({ address })),
    date: new Date(at).toISOString(),
    preview: '',
    unread: false,
    flagged: false,
    hasAttachments: false
  }
}

const ME = 'me@example.com'

describe('replyTimes', () => {
  it('measures each turn of a conversation, from the latest message before it', () => {
    expect(replyTimes([
      { at: 0, direction: 'received' },
      { at: HOUR, direction: 'received' },
      { at: 3 * HOUR, direction: 'sent' },
      { at: 4 * HOUR, direction: 'sent' },
      { at: 10 * HOUR, direction: 'received' }
    ])).toEqual({ yours: [2 * HOUR], theirs: [6 * HOUR] })
  })

  it('does not count a gap of more than a month as an answer', () => {
    expect(replyTimes([{ at: 0, direction: 'sent' }, { at: 40 * DAY, direction: 'received' }])).toEqual({ yours: [], theirs: [] })
  })
})

describe('computeRelationships', () => {
  it('counts both directions, leaves out yourself, machines and strangers who were never answered', () => {
    const inbox = [
      message('ana@example.com', [ME], NOW - 5 * DAY),
      message('ana@example.com', [ME], NOW - 4 * DAY, 'Other'),
      message('no-reply@shop.test', [ME], NOW - DAY),
      message('newsletter@news.test', [ME], NOW - DAY),
      message(ME, [ME], NOW - DAY)
    ]
    const sent = [message(ME, ['Ana@Example.com', ME], NOW - 3 * DAY)]
    const result = computeRelationships(inbox, sent, { self: [ME], now: NOW })

    expect(result.people.map(person => [person.address, person.received, person.sent])).toEqual([['ana@example.com', 2, 1]])
    expect(result.mostInTouch).toHaveLength(1)
  })

  it('takes people from the address book even if you never wrote to them', () => {
    const inbox = [message('cara@example.com', [ME], NOW - DAY)]
    const result = computeRelationships(inbox, [], { self: [ME], now: NOW, known: address => address === 'cara@example.com' })
    expect(result.people.map(person => person.address)).toEqual(['cara@example.com'])
  })

  it('folds a contact’s several addresses into one person', () => {
    const inbox = [message('ana@work.test', [ME], NOW - DAY)]
    const sent = [message(ME, ['ana@home.test', 'ana@work.test'], NOW - 2 * DAY)]
    const result = computeRelationships(inbox, sent, { self: [ME], now: NOW, canonical: () => 'ana@home.test' })
    expect(result.people).toHaveLength(1)
    expect(result.people[0]).toMatchObject({ address: 'ana@home.test', received: 1, sent: 1, total: 2 })
  })

  it('finds who is owed a reply and who you are waiting on, after two days', () => {
    const inbox = [
      message('owed@example.com', [ME], NOW - 3 * DAY),
      message('fresh@example.com', [ME], NOW - DAY),
      message('waited@example.com', [ME], NOW - 10 * DAY)
    ]
    const sent = [
      message(ME, ['owed@example.com'], NOW - 6 * DAY),
      message(ME, ['fresh@example.com'], NOW - 5 * DAY),
      message(ME, ['waited@example.com'], NOW - 4 * DAY)
    ]
    const result = computeRelationships(inbox, sent, { self: [ME], now: NOW })
    expect(result.oweReply.map(person => person.address)).toEqual(['owed@example.com'])
    expect(result.waiting.map(person => person.address)).toEqual(['waited@example.com'])
  })

  it('finds people you lost touch with: five messages or more, none for sixty days', () => {
    const old = (address: string, count: number) => Array.from({ length: count }, (_, index) => message(address, [ME], NOW - (70 + index) * DAY))
    const inbox = [...old('lost@example.com', 4), ...old('few@example.com', 3)]
    const sent = [message(ME, ['lost@example.com'], NOW - 65 * DAY), message(ME, ['few@example.com'], NOW - 65 * DAY)]
    const result = computeRelationships(inbox, sent, { self: [ME], now: NOW })
    expect(result.lostTouch.map(person => person.address)).toEqual(['lost@example.com'])
  })

  it('works out the median reply time each way, within a conversation', () => {
    const inbox = [
      message('ana@example.com', [ME], NOW - 10 * DAY, 'Plan'),
      message('ana@example.com', [ME], NOW - 10 * DAY + 5 * HOUR, 'Re: Plan'),
      message('ana@example.com', [ME], NOW - 5 * DAY, 'Lunch')
    ]
    const sent = [
      message(ME, ['ana@example.com'], NOW - 10 * DAY + 2 * HOUR, 'RE: plan'),
      message(ME, ['ana@example.com'], NOW - 5 * DAY + 4 * HOUR, 'Re: Lunch')
    ]
    const [ana] = computeRelationships(inbox, sent, { self: [ME], now: NOW }).people
    expect(ana).toMatchObject({ yourReplyMs: 3 * HOUR, yourReplies: 2, theirReplyMs: 3 * HOUR, theirReplies: 1 })
  })

  it('ranks the most in touch by messages exchanged and keeps ten', () => {
    const sent = Array.from({ length: 12 }, (_, index) => Array.from({ length: index + 1 }, () => message(ME, [`p${index}@example.com`], NOW - DAY))).flat()
    const result = computeRelationships([], sent, { self: [ME], now: NOW })
    expect(result.mostInTouch).toHaveLength(10)
    expect(result.mostInTouch[0]!.address).toBe('p11@example.com')
  })
})

describe('formatting', () => {
  it('says waits and ages plainly', () => {
    expect(formatWait(20_000)).toBe('under a minute')
    expect(formatWait(40 * 60_000)).toBe('40 min')
    expect(formatWait(3 * HOUR)).toBe('3 h')
    expect(formatWait(30 * HOUR)).toBe('1 day')
    expect(formatWait(5 * DAY)).toBe('5 days')
    expect(formatAgo(NOW - HOUR, NOW)).toBe('today')
    expect(formatAgo(NOW - DAY, NOW)).toBe('yesterday')
    expect(formatAgo(NOW - 12 * DAY, NOW)).toBe('12 days ago')
    expect(formatAgo(NOW - 90 * DAY, NOW)).toBe('3 months ago')
  })

  it('recognises machines', () => {
    expect(isAutomated('no-reply@shop.test')).toBe(true)
    expect(isAutomated('noreply+abc@shop.test')).toBe(true)
    expect(isAutomated('notifications@github.test')).toBe(true)
    expect(isAutomated('nora@example.com')).toBe(false)
  })
})
