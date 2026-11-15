import { describe, expect, it } from 'vitest'
import { baseDomain, claimedBrand, dueLabel, labelPrompt, linkSignals, newsletterPrompt, priorityPrompt, readLabels, readNewsletters, readPriority, readScam, readTasks, scamPrompt, senderSignals, taskNote, textSignals, triageEntry, validDay } from '../app/utils/ai-triage'

const message = (from: { name?: string, address: string }, subject = 'Hello', preview = 'Some text') => ({ from, subject, date: '2026-11-15T09:00:00Z', preview })

describe('senderSignals', () => {
  it('notices a brand name on an address that is not the brand’s', () => {
    expect(senderSignals({ name: 'PayPal Support', address: 'help@paypa1-secure.xyz' })).toEqual(['The sender’s name says “paypal” but the address is at paypa1-secure.xyz'])
    expect(senderSignals({ name: 'PayPal', address: 'alert@paypal-security.com' })).toHaveLength(1)
  })

  it('leaves the real brand alone, subdomains and country domains included', () => {
    expect(senderSignals({ name: 'PayPal', address: 'service@paypal.com' })).toEqual([])
    expect(senderSignals({ name: 'Amazon.co.uk', address: 'order@marketplace.amazon.co.uk' })).toEqual([])
    expect(senderSignals({ name: 'Apple', address: 'no_reply@email.apple.com' })).toEqual([])
    expect(senderSignals({ name: 'HMRC', address: 'noreply@hmrc.gov.uk' })).toEqual([])
  })

  it('does not see a brand inside another word', () => {
    expect(claimedBrand('Pineapple Studio')).toBeUndefined()
    expect(claimedBrand('Groups and Teams')).toBeUndefined()
    expect(claimedBrand('Microsoft account team')).toBe('microsoft')
  })

  it('notices a name that shows a different address', () => {
    expect(senderSignals({ name: 'billing@acme.com', address: 'x@elsewhere.net' })).toEqual(['The sender’s name shows billing@acme.com but the mail came from x@elsewhere.net'])
    expect(senderSignals({ name: 'ana@acme.com', address: 'ana@acme.com' })).toEqual([])
  })

  it('notices look-alike characters', () => {
    expect(senderSignals({ address: 'support@xn--pple-43d.com' })).toEqual(['The sender’s address uses look-alike characters'])
  })

  it('says nothing about ordinary people', () => {
    expect(senderSignals({ name: 'Ana Ruiz', address: 'ana@ruiz.es' })).toEqual([])
  })
})

describe('textSignals', () => {
  it('notices payment and pressure words', () => {
    expect(textSignals({ subject: 'Urgent: update your payment details', preview: 'Your account will be suspended within 24 hours' })).toEqual([
      'It talks about payments, bank details or gift cards',
      'It pushes you to act fast or to confirm account details'
    ])
    expect(textSignals({ subject: 'Quick favour', preview: 'Can you buy some gift cards for the team?' })).toHaveLength(1)
  })

  it('leaves ordinary mail alone', () => {
    expect(textSignals({ subject: 'Lunch on Friday?', preview: 'Shall we try the new place by the station?' })).toEqual([])
  })
})

describe('linkSignals', () => {
  it('notices a link whose text shows another site', () => {
    const html = '<p>Sign in at <a target="_blank" href="https://login.evil.example/paypal">www.paypal.com</a></p>'
    expect(linkSignals(html)).toEqual(['A link’s text shows paypal.com but it goes to login.evil.example'])
  })

  it('reads the text through formatting and entities', () => {
    const html = '<a href="http://track.bad.io/?a=1&amp;b=2"><span><b>https://bank.co.uk/login</b></span></a>'
    expect(linkSignals(html)).toEqual(['A link’s text shows bank.co.uk but it goes to track.bad.io'])
  })

  it('accepts a link to the same site, and plain words', () => {
    const html = '<a href="https://www.paypal.com/signin">paypal.com</a> <a href="https://x.example">Read more</a> <a href="https://mail.google.com">google.com/mail</a>'
    expect(linkSignals(html)).toEqual([])
  })

  it('notices a link to a bare number address', () => {
    expect(linkSignals('<a href="http://192.168.4.20/login">Log in</a>')).toEqual(['A link goes to a bare number address instead of a website name'])
  })

  it('ignores mail and phone links', () => {
    expect(linkSignals('<a href="mailto:a@b.com">www.b.com</a>')).toEqual([])
  })
})

describe('baseDomain', () => {
  it('keeps the bought part of a host', () => {
    expect(baseDomain('mail.paypal.com')).toBe('paypal.com')
    expect(baseDomain('www.bbc.co.uk')).toBe('bbc.co.uk')
    expect(baseDomain('example.com')).toBe('example.com')
  })
})

describe('prompts', () => {
  it('numbers the emails and trims the preview', () => {
    const entry = triageEntry(message({ name: 'Ana', address: 'ana@x.es' }, 'Hi', `a\n\nb ${'x'.repeat(1000)}`), 3)
    expect(entry.startsWith('[3] From: Ana <ana@x.es>\nSubject: Hi\nDate: 2026-11-15T09:00:00Z\nPreview: a b x')).toBe(true)
    expect(entry.split('Preview: ')[1]).toHaveLength(600)
  })

  it('puts the reader’s corrections ahead of the emails', () => {
    const prompt = priorityPrompt([message({ address: 'a@b.c' })], [{ from: 'news@shop.com', subject: 'Sale', kind: 'fyi' }])
    expect(prompt).toContain('- From news@shop.com, “Sale” → fyi')
    expect(prompt.indexOf('Sale')).toBeLessThan(prompt.indexOf('[1] From'))
  })

  it('lists label ids with example subjects', () => {
    const prompt = labelPrompt([message({ address: 'a@b.c' })], [{ id: 'k1', name: 'Travel', examples: ['Your flight to Lisbon'] }])
    expect(prompt).toContain('- id "k1": Travel. For example: “Your flight to Lisbon”')
  })

  it('adds local checks to the scam prompt', () => {
    const prompt = scamPrompt([{ ...message({ address: 'a@b.c' }), signals: ['One', 'Two'] }, { ...message({ address: 'd@e.f' }), signals: [] }])
    expect(prompt).toContain('Local checks: One; Two')
    expect(prompt).toContain('Local checks: nothing found')
  })

  it('describes each list for the newsletter advisor', () => {
    expect(newsletterPrompt([{ name: 'Weekly', address: 'w@x.com', count: 4, lastDate: '2026-11-10T08:00:00Z', inInbox: 3, unread: 3 }]))
      .toBe('The lists:\n[1] Weekly <w@x.com>: 4 messages, latest 2026-11-10; 3 of 3 in the Inbox unread')
  })
})

describe('reading answers', () => {
  it('maps priority answers to messages, dropping what it can’t place', () => {
    const result = readPriority({ messages: [
      { n: 1, category: 'Reply', reason: 'Ana asks  when you can meet' },
      { n: 2, category: 'needs-action', reason: null },
      { n: 3, category: 'spam', reason: 'x' },
      { n: 9, category: 'fyi', reason: 'x' },
      { n: 1, category: 'fyi', reason: 'again' }
    ] }, 3)
    expect([...result.entries()]).toEqual([[0, { kind: 'reply', reason: 'Ana asks when you can meet' }], [1, { kind: 'act', reason: '' }]])
  })

  it('keeps scam reasons short, and none for safe mail', () => {
    const result = readScam({ messages: [{ n: 1, verdict: 'dangerous', reasons: ['a', 'b', 'c', 'd'] }, { n: 2, verdict: 'safe', reasons: ['x'] }, { n: 3, verdict: 'odd' }] }, 3)
    expect(result.get(0)).toEqual({ verdict: 'dangerous', reasons: ['a', 'b', 'c'] })
    expect(result.get(1)).toEqual({ verdict: 'safe', reasons: [] })
    expect(result.has(2)).toBe(false)
  })

  it('keeps only known, confident labels, two at most', () => {
    const result = readLabels({ messages: [{ n: 1, labels: [{ id: 'a', confidence: 0.75 }, { id: 'b', confidence: 0.95 }, { id: 'c', confidence: 0.9 }, { id: 'zz', confidence: 1 }] }, { n: 2, labels: [{ id: 'a', confidence: 0.4 }] }] }, 2, ['a', 'b', 'c'])
    expect(result.get(0)).toEqual([{ id: 'b', confidence: 0.95 }, { id: 'c', confidence: 0.9 }])
    expect(result.get(1)).toEqual([])
  })

  it('reads tasks with real dates and who they are for', () => {
    const tasks = readTasks({ tasks: [
      { n: 1, text: 'Send the signed contract', due: '2026-11-21', who: 'me' },
      { n: 2, text: 'Book the venue', due: '2026-02-30', who: 'Ana' },
      { n: 5, text: 'Out of range' },
      { n: 1, text: '  ' }
    ] }, 2)
    expect(tasks).toEqual([
      { text: 'Send the signed contract', due: '2026-11-21', who: undefined, source: 0 },
      { text: 'Book the venue', due: undefined, who: 'Ana', source: 1 }
    ])
    expect(readTasks({ tasks: [{ text: 'Reply to Ana' }] }, 1)).toEqual([{ text: 'Reply to Ana', due: undefined, who: undefined, source: 0 }])
  })

  it('checks days are real', () => {
    expect(validDay('2028-02-29')).toBe('2028-02-29')
    expect(validDay('2026-13-01')).toBeUndefined()
    expect(validDay('Friday')).toBeUndefined()
  })

  it('writes the note a Later card carries', () => {
    expect(dueLabel('2026-11-21', 'en-GB')).toBe('Sat 21 Nov')
    expect(taskNote([{ text: 'Send the contract', due: '2026-11-20' }, { text: 'Book the venue', who: 'Ana' }], 'en-GB')).toBe('Due Fri 20 Nov · Send the contract; Book the venue (Ana)')
  })

  it('ranks newsletters once each', () => {
    expect(readNewsletters({ leave: [{ n: 2, reason: 'Never opened' }, { n: 2, reason: 'again' }, { n: 0, reason: 'x' }, { n: 1 }] }, 2)).toEqual([{ index: 1, reason: 'Never opened' }, { index: 0, reason: '' }])
  })
})
