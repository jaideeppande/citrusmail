import { describe, expect, it } from 'vitest'
import {
  aiEventPreview, aiLocalDate, aiWhen, aiWhenLabel, applySignature, asksForReminder, attendeesLine, briefingBullets, briefingPrompt, briefingSchema,
  canPrepare, mailEventFill, mailEventNotes, mailEventPrompt, mailEventSchema, meetingPrepPrompt, meetingPrepResult, meetingPrepSchema, ownWords,
  peopleInEvent, addressesInEvent, quickEventPlan, quickEventPrompt, quickEventSchema, relationshipPrompt, relationshipText, samePhone,
  signatureChanges, signatureLine, signaturePrompt, signatureSchema, signatureTail, waitingOnOthers
} from '../app/utils/ai-calendar'

// Sunday 15 November 2026, 10:00 local
const now = new Date(2026, 10, 15, 10, 0)

const summary = (id: string, extra: Partial<MessageSummary> = {}): MessageSummary => ({
  id,
  folder: 'INBOX',
  subject: `Subject ${id}`,
  from: { name: 'Ana Ruiz', address: 'ana@studio.example' },
  to: [{ address: 'me@example.com' }],
  date: '2026-11-15T08:00:00.000Z',
  preview: 'Preview text',
  unread: true,
  flagged: false,
  hasAttachments: false,
  ...extra
})

const contact = (id: string, name: string, emails: string[], extra: Partial<Contact> = {}): Contact => ({ id, bookId: 'b', name, emails, phones: [], ...extra })

describe('aiLocalDate', () => {
  it('reads date-times and dates as local time', () => {
    expect(aiLocalDate('2026-11-20T13:00')).toEqual({ date: new Date(2026, 10, 20, 13, 0), hasTime: true })
    expect(aiLocalDate('2026-11-20')).toEqual({ date: new Date(2026, 10, 20), hasTime: false })
    expect(aiLocalDate('2026-11-20 09:30:00')?.date).toEqual(new Date(2026, 10, 20, 9, 30))
  })

  it('reads the wall-clock time even when an offset comes with it', () => {
    expect(aiLocalDate('2026-11-20T13:00:00Z')?.date).toEqual(new Date(2026, 10, 20, 13, 0))
    expect(aiLocalDate('2026-11-20T13:00:00+02:00')?.date).toEqual(new Date(2026, 10, 20, 13, 0))
  })

  it('refuses made-up dates and anything that is not a date', () => {
    expect(aiLocalDate('2026-02-31')).toBeUndefined()
    expect(aiLocalDate('2026-11-20T25:00')).toBeUndefined()
    expect(aiLocalDate('next Thursday')).toBeUndefined()
    expect(aiLocalDate(null)).toBeUndefined()
    expect(aiLocalDate(42)).toBeUndefined()
  })
})

describe('aiWhen', () => {
  it('gives a timed event with no end an hour', () => {
    expect(aiWhen({ start: '2026-11-20T13:00', end: null, allDay: false }, now)).toEqual({ start: new Date(2026, 10, 20, 13), end: new Date(2026, 10, 20, 14), allDay: false })
  })

  it('replaces an end before the start', () => {
    expect(aiWhen({ start: '2026-11-20T13:00', end: '2026-11-20T12:00' }, now)?.end).toEqual(new Date(2026, 10, 20, 14))
  })

  it('makes an all-day end the day after the last day covered', () => {
    expect(aiWhen({ start: '2026-11-20', end: '2026-11-22', allDay: true }, now)).toEqual({ start: new Date(2026, 10, 20), end: new Date(2026, 10, 23), allDay: true })
    expect(aiWhen({ start: '2026-11-20', end: null }, now)).toEqual({ start: new Date(2026, 10, 20), end: new Date(2026, 10, 21), allDay: true })
  })

  it('takes a date-time marked all day as its day', () => {
    expect(aiWhen({ start: '2026-11-20T13:00', allDay: true }, now)).toEqual({ start: new Date(2026, 10, 20), end: new Date(2026, 10, 21), allDay: true })
  })

  it('refuses anything more than two years away', () => {
    expect(aiWhen({ start: '2029-01-01T10:00' }, now)).toBeUndefined()
    expect(aiWhen({ start: '2024-01-01T10:00' }, now)).toBeUndefined()
    expect(aiWhen({ start: '2026-11-20', end: '2030-01-01', allDay: true }, now)).toBeUndefined()
    expect(aiWhen({ start: 'soon' }, now)).toBeUndefined()
  })
})

describe('aiWhenLabel and aiEventPreview', () => {
  it('says a timed event on one line', () => {
    expect(aiEventPreview({ title: 'Lunch with Ana', start: new Date(2026, 10, 19, 13), end: new Date(2026, 10, 19, 14), allDay: false }, 'Personal'))
      .toBe('Lunch with Ana · Thu 19 Nov, 13:00–14:00 · Personal')
  })

  it('says all-day events and spans', () => {
    expect(aiWhenLabel({ start: new Date(2026, 10, 19), end: new Date(2026, 10, 20), allDay: true })).toBe('Thu 19 Nov, all day')
    expect(aiWhenLabel({ start: new Date(2026, 10, 19), end: new Date(2026, 10, 22), allDay: true })).toBe('Thu 19 – Sat 21 Nov')
    expect(aiWhenLabel({ start: new Date(2026, 10, 30), end: new Date(2026, 11, 2), allDay: true })).toBe('Mon 30 Nov – Tue 1 Dec')
  })

  it('keeps an event ending at midnight on its day, and spells out one that runs on', () => {
    expect(aiWhenLabel({ start: new Date(2026, 10, 19, 22), end: new Date(2026, 10, 20, 0), allDay: false })).toBe('Thu 19 Nov, 22:00–00:00')
    expect(aiWhenLabel({ start: new Date(2026, 10, 19, 22), end: new Date(2026, 10, 20, 1), allDay: false })).toBe('Thu 19 Nov 22:00 – Fri 20 Nov 01:00')
  })
})

describe('quick events', () => {
  const calendars = [{ id: 'work', name: 'Work' }, { id: 'home', name: 'Personal' }]

  it('builds a prompt with the day, zone, calendars and the phrase as data', () => {
    const prompt = quickEventPrompt('Lunch with Ana Thursday at 1', { now, timeZone: 'Europe/Madrid', calendars: ['Work', 'Personal'] })
    expect(prompt).toContain('Now: Sunday 2026-11-15T10:00 (Europe/Madrid)')
    expect(prompt).toContain('Calendars: “Work”, “Personal”')
    expect(prompt).toContain('Phrase: “Lunch with Ana Thursday at 1”')
  })

  it('turns an answer into a plan on the named calendar, with the place in the notes', () => {
    const answer = quickEventSchema.parse({ title: 'Lunch with Ana', start: '2026-11-19T13:00', end: null, allDay: false, calendar: 'personal', location: 'Nobu', description: null, reminder: false })
    expect(quickEventPlan(answer, { text: 'Lunch with Ana Thursday at 1 at Nobu', now, calendars })).toEqual({
      title: 'Lunch with Ana',
      start: new Date(2026, 10, 19, 13),
      end: new Date(2026, 10, 19, 14),
      allDay: false,
      calendarId: 'home',
      description: 'Where: Nobu',
      reminder: false
    })
  })

  it('leaves an unknown calendar to the default, and notices a reminder either way', () => {
    const answer = quickEventSchema.parse({ title: 'Dentist', start: '2026-11-18T09:00', calendar: 'Health' })
    const plan = quickEventPlan(answer, { text: 'Dentist Wednesday 9am, remind me the day before', now, calendars })
    expect(plan?.calendarId).toBeUndefined()
    expect(plan?.reminder).toBe(true)
    expect(asksForReminder('Movie at 7')).toBe(false)
  })

  it('refuses a plan whose date does not hold', () => {
    const answer = quickEventSchema.parse({ title: 'Trip', start: '2031-01-01' })
    expect(quickEventPlan(answer, { text: 'Trip', now, calendars })).toBeUndefined()
  })

  it('falls back to the phrase for an empty title', () => {
    const answer = quickEventSchema.parse({ title: '  ', start: '2026-11-19T13:00' })
    expect(quickEventPlan(answer, { text: 'Thursday 1pm', now, calendars })?.title).toBe('Thursday 1pm')
  })

  it('rejects an answer missing its start', () => {
    expect(quickEventSchema.safeParse({ title: 'Lunch' }).success).toBe(false)
  })
})

describe('event from an email', () => {
  it('builds a prompt with the reader and the date they picked', () => {
    const prompt = mailEventPrompt('From: Ana\nSubject: Review', { now, timeZone: 'UTC', me: 'me@example.com', hint: new Date(2026, 10, 19, 15) })
    expect(prompt.split('\n')).toEqual([
      'Now: Sunday 2026-11-15T10:00 (UTC)',
      'The reader: me@example.com',
      'The reader picked the date 2026-11-19T15:00 in the email: describe the event at that time.',
      '',
      'The email:',
      'From: Ana',
      'Subject: Review'
    ])
    expect(mailEventPrompt('x', { now, timeZone: 'UTC' }).split('\n')).toEqual(['Now: Sunday 2026-11-15T10:00 (UTC)', '', 'The email:', 'x'])
  })

  it('keeps real attendees once each, without the reader', () => {
    const answer = mailEventSchema.parse({
      title: 'Design review',
      start: '2026-11-19T15:00',
      end: '2026-11-19T16:00',
      allDay: false,
      location: 'Room 4',
      attendees: [
        { name: 'Ana Ruiz', address: 'ANA@studio.example' },
        { name: 'Ana', address: 'ana@studio.example' },
        { name: 'Me', address: 'me@example.com' },
        { name: 'Bo', address: null },
        { name: null, address: 'not an address' }
      ]
    })
    const fill = mailEventFill(answer, { now, me: 'me@example.com' })
    expect(fill.when).toEqual({ start: new Date(2026, 10, 19, 15), end: new Date(2026, 10, 19, 16), allDay: false })
    expect(fill.attendees).toEqual([{ name: 'Ana Ruiz', address: 'ana@studio.example' }, { name: 'Bo', address: '' }])
    expect(attendeesLine(fill.attendees)).toBe('With: Ana Ruiz <ana@studio.example>, Bo')
    expect(mailEventNotes(fill, 'From Ana\n\nSee you then')).toBe('Where: Room 4\nWith: Ana Ruiz <ana@studio.example>, Bo\n\nFrom Ana\n\nSee you then')
  })

  it('leaves the time alone when the email names none', () => {
    const fill = mailEventFill(mailEventSchema.parse({ title: 'Catch up', start: null, attendees: null }), { now })
    expect(fill.when).toBeUndefined()
    expect(fill.attendees).toEqual([])
    expect(mailEventNotes(fill, 'Notes')).toBe('Notes')
  })
})

describe('daily briefing', () => {
  const mail = [summary('1', { subject: 'Contract', preview: 'Can you sign by Friday?' }), summary('2', { subject: 'Newsletter' })]
  const waiting = [{ message: summary('9', { folder: 'Sent', subject: 'Quote', to: [{ name: 'Bo', address: 'bo@example.com' }] }), days: 4 }]
  const events: CalendarEvent[] = [{ id: 'ev1', calendarId: 'work', title: 'Stand-up', start: '2026-11-15T09:30:00', end: '2026-11-15T09:45:00' }]

  it('lists mail, waiting messages and events with ids', () => {
    const prompt = briefingPrompt({ now, mail, waiting, events })
    expect(prompt).toContain('m1. 2026-11-15 08:00 — from Ana Ruiz <ana@studio.example> — “Contract” — Can you sign by Friday?')
    expect(prompt).toContain('w1. sent 4 days ago to Bo — “Quote”')
    expect(prompt).toContain('e1. 09:30–09:45 — Stand-up')
    expect(briefingPrompt({ now, mail: [], waiting: [], events: [] })).toContain('New mail:\nnone')
  })

  it('tags mail with the priority inbox’s verdict when there is one', () => {
    const prompt = briefingPrompt({ now, mail, verdicts: [{ kind: 'reply', reason: 'Asks you to sign' }, undefined], waiting: [], events: [] })
    expect(prompt).toContain('m1. [reply: Asks you to sign] 2026-11-15 08:00')
    expect(prompt).toContain('m2. 2026-11-15 08:00')
  })

  it('ties bullets to what their id names, and drops ids that name nothing', () => {
    const answer = briefingSchema.parse({ bullets: [
      { text: '- **Ana** wants the contract signed by Friday.', ref: 'm1' },
      { text: 'Bo hasn’t answered your quote.', ref: 'W1' },
      { text: 'Stand-up at 09:30.', ref: 'e1' },
      { text: 'Something else.', ref: 'm7' },
      { text: '   ', ref: null }
    ] })
    expect(briefingBullets(answer, { now, mail, waiting, events })).toEqual([
      { text: 'Ana wants the contract signed by Friday.', target: { kind: 'message', folder: 'INBOX', id: '1', label: 'Contract' } },
      { text: 'Bo hasn’t answered your quote.', target: { kind: 'message', folder: 'Sent', id: '9', label: 'Quote' } },
      { text: 'Stand-up at 09:30.', target: { kind: 'event', id: 'ev1', start: '2026-11-15T09:30:00', label: 'Stand-up' } },
      { text: 'Something else.', target: undefined }
    ])
  })

  it('keeps at most six bullets and needs at least one', () => {
    const many = briefingSchema.parse({ bullets: Array.from({ length: 9 }, (_, index) => ({ text: `Point ${index}` })) })
    expect(briefingBullets(many, { now, mail: [], waiting: [], events: [] })).toHaveLength(6)
    expect(briefingSchema.safeParse({ bullets: [] }).success).toBe(false)
  })

  it('finds your messages nobody has answered', () => {
    const day = 86_400_000
    const at = (days: number) => new Date(now.getTime() - days * day).toISOString()
    const sent = [
      summary('a', { folder: 'Sent', subject: 'Quote', to: [{ address: 'bo@example.com' }], date: at(4) }),
      summary('b', { folder: 'Sent', subject: 'Answered', to: [{ address: 'cy@example.com' }], date: at(5) }),
      summary('c', { folder: 'Sent', subject: 'Too new', to: [{ address: 'cy@example.com' }], date: at(1) }),
      summary('d', { folder: 'Sent', subject: 'To myself', to: [{ address: 'me@example.com' }], date: at(5) }),
      summary('e', { folder: 'Sent', subject: 'Old', to: [{ address: 'cy@example.com' }], date: at(40) })
    ]
    const inbox = [summary('r', { subject: 'Re: Answered', from: { address: 'CY@example.com' }, date: at(3) })]
    expect(waitingOnOthers(sent, inbox, { self: ['me@example.com'], days: 3, now: now.getTime() }).map(item => [item.message.id, item.days])).toEqual([['a', 4]])
  })
})

describe('meeting prep', () => {
  const contacts = [
    contact('1', 'Ana Ruiz', ['ana@studio.example']),
    contact('2', 'Bo Chen', ['bo@example.com']),
    contact('3', 'Bo Lind', ['lind@example.com']),
    contact('4', 'Cyrus Vale', ['cy@example.com']),
    contact('5', 'Me Myself', ['me@example.com'])
  ]

  it('finds people by full name, address or a first name only one contact has', () => {
    expect(peopleInEvent({ title: 'Lunch with Ana', description: '' }, contacts).map(person => person.id)).toEqual(['1'])
    expect(peopleInEvent({ title: 'Sync', description: 'With: Bo Chen, cy@example.com' }, contacts).map(person => person.id)).toEqual(['2', '4'])
    // Two Bos: a first name alone can't say which
    expect(peopleInEvent({ title: 'Call Bo', description: '' }, contacts)).toEqual([])
    // Part of another word is not a name
    expect(peopleInEvent({ title: 'Banana bread', description: '' }, contacts)).toEqual([])
    expect(peopleInEvent({ title: 'Me Myself review', description: '' }, contacts, ['me@example.com'])).toEqual([])
  })

  it('picks up addresses that belong to nobody in the address book', () => {
    expect(addressesInEvent({ title: 'Call', description: 'With: Ana Ruiz <ana@studio.example>, zed@other.example' }, [contacts[0]!], ['me@example.com'])).toEqual(['zed@other.example'])
  })

  it('is offered from a day ago to a week ahead', () => {
    const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
    expect(canPrepare({ start: at(24), end: at(25) }, now.getTime())).toBe(true)
    expect(canPrepare({ start: at(-20), end: at(-19) }, now.getTime())).toBe(true)
    expect(canPrepare({ start: at(-30), end: at(-29) }, now.getTime())).toBe(false)
    expect(canPrepare({ start: at(24 * 8), end: at(24 * 8 + 1) }, now.getTime())).toBe(false)
  })

  it('builds a prompt with full text only for the messages it has', () => {
    const messages = [
      { message: summary('1'), direction: 'received' as const },
      { message: summary('2', { folder: 'Sent', to: [{ name: 'Ana', address: 'ana@studio.example' }] }), direction: 'sent' as const }
    ]
    const prompt = meetingPrepPrompt({
      event: { title: 'Lunch with Ana', start: '2026-11-19T13:00:00', end: '2026-11-19T14:00:00', description: '' },
      people: [{ name: 'Ana Ruiz', emails: ['ana@studio.example'] }],
      messages,
      bodies: [{ folder: 'INBOX', id: '1', text: 'Can we talk budgets?' }]
    })
    expect(prompt).toContain('The meeting: “Lunch with Ana”, Thursday 19 November, 13:00–14:00')
    expect(prompt).toContain('With: Ana Ruiz <ana@studio.example>')
    expect(prompt).toContain('m1. 2026-11-15 — from Ana Ruiz — “Subject 1” — Preview text\nFull text of m1:\n<<<\nCan we talk budgets?\n>>>')
    expect(prompt).toContain('m2. 2026-11-15 — you wrote to Ana — “Subject 2”')
    expect(prompt).not.toContain('Full text of m2')
  })

  it('ties items to the messages they come from', () => {
    const messages = [{ message: summary('1') }, { message: summary('2') }]
    const answer = meetingPrepSchema.parse({ context: 'Budget talk.', asksOfYou: [{ text: 'Send the numbers', ref: 'm2' }, { text: '' }], openQuestions: null })
    expect(meetingPrepResult(answer, messages)).toEqual({
      context: 'Budget talk.',
      asksOfYou: [{ text: 'Send the numbers', message: { folder: 'INBOX', id: '2' } }],
      openQuestions: []
    })
  })
})

describe('details from signatures', () => {
  it('sends only the end of each message, numbered', () => {
    expect(signatureTail('a'.repeat(2000) + 'END', 10)).toBe(`${'a'.repeat(7)}END`)
    expect(signaturePrompt([{ from: { name: 'Ana', address: 'ana@studio.example' }, tail: 'Ana\nFinance lead' }])).toBe('Email 1, from Ana <ana@studio.example>:\n<<<\nAna\nFinance lead\n>>>')
  })

  it('cuts the quoted message under a reply but keeps links', () => {
    expect(ownWords('Thanks!\nhttps://meet.example/abc\n\nOn Mon, Ana wrote:\n> old')).toBe('Thanks!\nhttps://meet.example/abc')
  })

  it('compares phone numbers by their last digits', () => {
    expect(samePhone('+1 555 0101 222', '(555) 0101-222')).toBe(true)
    expect(samePhone('+1 555 0101', '+1 555 0102')).toBe(false)
  })

  it('suggests only what differs from the contact', () => {
    const ana = contact('1', 'Ana Ruiz', ['ana@studio.example'], { phones: ['+1 555 0101 222'], title: 'Finance lead' })
    expect(signatureChanges(ana, { phone: '555-0101-222', title: 'finance lead', company: 'Studio Ruiz' })).toEqual({ company: 'Studio Ruiz' })
    expect(signatureChanges(ana, { phone: '+1 555 0101 222', title: 'Finance Lead' })).toBeUndefined()
    expect(signatureChanges(ana, { phone: 'ext. 4' })).toBeUndefined()
  })

  it('says and applies a suggestion without dropping old numbers', () => {
    const details = { title: 'Finance lead', company: 'Studio Ruiz', phone: '+1 555 0199' }
    expect(signatureLine(details)).toBe('Finance lead at Studio Ruiz, +1 555 0199')
    expect(signatureLine({ phone: '+1 555 0199' })).toBe('+1 555 0199')
    const ana = contact('1', 'Ana Ruiz', ['ana@studio.example'], { phones: ['+1 555 0101'], title: 'Analyst' })
    expect(applySignature(ana, details)).toEqual({ ...ana, phones: ['+1 555 0199', '+1 555 0101'], title: 'Finance lead', company: 'Studio Ruiz' })
  })

  it('parses the answer shape', () => {
    expect(signatureSchema.safeParse({ people: [{ n: 1, phone: null, title: 'CEO', company: null }] }).success).toBe(true)
    expect(signatureSchema.safeParse({ people: [{ phone: '1' }] }).success).toBe(false)
  })
})

describe('relationship summary', () => {
  it('builds a prompt that says who wrote each message', () => {
    const prompt = relationshipPrompt({
      name: 'Ana Ruiz',
      addresses: ['ana@studio.example'],
      messages: [{ message: summary('1'), direction: 'received' }, { message: summary('2'), direction: 'sent' }],
      bodies: [{ folder: 'INBOX', id: '2', text: 'Body two' }]
    })
    expect(prompt).toContain('The person: Ana Ruiz <ana@studio.example>')
    expect(prompt).toContain('1. 2026-11-15 — they wrote — “Subject 1”')
    expect(prompt).toContain('2. 2026-11-15 — you wrote — “Subject 2” — Preview text\nFull text:\n<<<\nBody two\n>>>')
  })

  it('flattens the answer into one plain paragraph', () => {
    expect(relationshipText('## Summary\n- You and **Ana** talk budgets.\n- Tone is warm.')).toBe('Summary You and Ana talk budgets. Tone is warm.')
  })
})
