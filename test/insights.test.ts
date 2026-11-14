import { describe, expect, it } from 'vitest'
import { computeInsights, formatDuration, median, niceMax, normaliseSubject, responseTimes } from '../app/utils/insights'

let next = 0
function message(date: Date, from: string, subject = 'Hello', to: string[] = ['me@example.com']): MessageSummary {
  return {
    id: String(++next),
    folder: 'INBOX',
    subject,
    from: { address: from, name: from.split('@')[0] },
    to: to.map(address => ({ address })),
    date: date.toISOString(),
    preview: '',
    unread: false,
    flagged: false,
    hasAttachments: false
  }
}

// Noon on a fixed day, so a test never straddles midnight
const now = new Date(2026, 10, 14, 12, 0)
const ago = (days: number, hour = 9) => new Date(2026, 10, 14 - days, hour, 0)

describe('insights', () => {
  it('reads Re: and Fwd: prefixes off a subject', () => {
    expect(normaliseSubject('Re: RE: Fwd:  Lunch  on Friday ')).toBe('lunch on friday')
    expect(normaliseSubject('AW: Re[2]: Termin')).toBe('termin')
    expect(normaliseSubject('Regarding lunch')).toBe('regarding lunch')
  })

  it('takes the median of odd and even counts, and of nothing', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeUndefined()
  })

  it('counts received and sent over 7 and 30 days, by local day', () => {
    const inbox = [message(ago(0), 'a@x.test'), message(ago(6), 'a@x.test'), message(ago(7), 'b@x.test'), message(ago(29), 'b@x.test'), message(ago(30), 'c@x.test')]
    const sent = [message(ago(1), 'me@example.com'), message(ago(12), 'me@example.com'), message(ago(45), 'me@example.com')]
    const result = computeInsights(inbox, sent, now)
    expect(result.received7).toBe(2)
    expect(result.received30).toBe(4)
    expect(result.sent7).toBe(1)
    expect(result.sent30).toBe(2)
    expect(result.days).toHaveLength(30)
    expect(result.days[29]).toMatchObject({ received: 1, sent: 0 })
    expect(result.days[28]).toMatchObject({ received: 0, sent: 1 })
    expect(result.days[0]).toMatchObject({ received: 1 })
    expect(result.days[29]!.date.getDate()).toBe(14)
  })

  it('leaves out mail dated in the future or not dated at all', () => {
    const broken = { ...message(ago(1), 'a@x.test'), date: 'not a date' }
    const result = computeInsights([message(ago(-2), 'a@x.test'), broken], [], now)
    expect(result.received30).toBe(0)
  })

  it('finds the busiest hours and the people who write most', () => {
    const inbox = [message(ago(1, 9), 'a@x.test'), message(ago(2, 9), 'A@x.test'), message(ago(3, 17), 'b@x.test')]
    const result = computeInsights(inbox, [], now)
    expect(result.hours[9]).toBe(2)
    expect(result.hours[17]).toBe(1)
    expect(result.hours).toHaveLength(24)
    expect(result.senders[0]).toMatchObject({ address: 'a@x.test', count: 2 })
    expect(result.senders[1]).toMatchObject({ address: 'b@x.test', count: 1 })
  })

  it('keeps the top eight senders', () => {
    const inbox = Array.from({ length: 12 }, (_, i) => message(ago(1), `p${i}@x.test`))
    expect(computeInsights(inbox, [], now).senders).toHaveLength(8)
  })

  it('measures the first answer to each message, to the person who wrote it', () => {
    const inbox = [
      message(ago(3, 9), 'ann@x.test', 'Budget'),
      message(ago(2, 9), 'bob@x.test', 'Offsite'),
      message(ago(2, 10), 'cat@x.test', 'Budget')
    ]
    const sent = [
      // Two hours after Ann, then again later: only the first counts
      message(ago(3, 11), 'me@example.com', 'Re: Budget', ['ann@x.test']),
      message(ago(3, 15), 'me@example.com', 'RE: Budget', ['ann@x.test']),
      // Same subject as Bob’s, but not to him
      message(ago(2, 12), 'me@example.com', 'Re: Offsite', ['dan@x.test']),
      // Sent before Cat wrote: not an answer to her
      message(ago(2, 9), 'me@example.com', 'Budget', ['cat@x.test'])
    ]
    expect(responseTimes(inbox, sent)).toEqual([2 * 3_600_000])
    const result = computeInsights(inbox, sent, now)
    expect(result.responseMs).toBe(2 * 3_600_000)
    expect(result.responses).toBe(1)
  })

  it('has no response time without answers', () => {
    expect(computeInsights([message(ago(1), 'a@x.test')], [], now).responseMs).toBeUndefined()
  })

  it('says a duration in at most two units', () => {
    expect(formatDuration(20_000)).toBe('Under a minute')
    expect(formatDuration(42 * 60_000)).toBe('42 min')
    expect(formatDuration(90 * 60_000)).toBe('1 h 30 min')
    expect(formatDuration(3 * 3_600_000)).toBe('3 h')
    expect(formatDuration(50 * 3_600_000)).toBe('2 d 2 h')
  })

  it('rounds a chart’s scale up to a round number', () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(18)).toBe(20)
    expect(niceMax(33)).toBe(40)
    expect(niceMax(100)).toBe(100)
  })
})
