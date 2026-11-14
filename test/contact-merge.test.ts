import { describe, expect, it } from 'vitest'
import { findDuplicateGroups, mergeContacts, normaliseName, normalisePhone } from '../app/utils/contact-merge'
import { birthdayLabel, parseBirthday, upcomingBirthdays } from '../app/utils/birthdays'

function contact(id: string, fields: Partial<Contact> = {}): Contact {
  return { id, bookId: 'book', name: `Person ${id}`, emails: [], phones: [], ...fields }
}

describe('normalising', () => {
  it('reads a name whatever its case, accents, punctuation and word order', () => {
    expect(normaliseName('Ruiz, Ana')).toBe(normaliseName('ana  RUÍZ'))
    expect(normaliseName('  ')).toBe('')
  })

  it('matches a number with and without its country code', () => {
    expect(normalisePhone('+34 600 111 222')).toBe(normalisePhone('600-111-222'))
    expect(normalisePhone('0034 600 111 222')).toBe(normalisePhone('600111222'))
    expect(normalisePhone('112')).toBe('')
  })
})

describe('findDuplicateGroups', () => {
  it('finds nothing among people who share nothing', () => {
    expect(findDuplicateGroups([
      contact('a', { name: 'Ana Ruiz', emails: ['ana@example.com'] }),
      contact('b', { name: 'Ben Okri', emails: ['ben@example.com'] })
    ])).toEqual([])
  })

  it('groups by a shared address, whatever its case', () => {
    const groups = findDuplicateGroups([
      contact('a', { name: 'Ana Ruiz', emails: ['ana@example.com'] }),
      contact('b', { name: 'A. Ruiz', emails: ['ANA@example.com'] }),
      contact('c', { name: 'Ben Okri', emails: ['ben@example.com'] })
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.contacts.map(item => item.id)).toEqual(['a', 'b'])
    expect(groups[0]!.reasons).toEqual(['email'])
  })

  it('groups by name and by phone number', () => {
    const groups = findDuplicateGroups([
      contact('a', { name: 'Ana Ruiz' }),
      contact('b', { name: 'Ruiz, Ana' }),
      contact('c', { name: 'Work', phones: ['+34 600 111 222'] }),
      contact('d', { name: 'Office', phones: ['600 111 222'] })
    ])

    expect(groups.map(group => group.reasons)).toEqual([['name'], ['phone']])
  })

  it('carries sharing over from one contact to the next', () => {
    const groups = findDuplicateGroups([
      contact('a', { name: 'Ana', emails: ['ana@example.com'] }),
      contact('b', { name: 'Ana R', emails: ['ana@example.com'], phones: ['600111222'] }),
      contact('c', { name: 'Ruiz', phones: ['+34600111222'] })
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.contacts).toHaveLength(3)
    expect(groups[0]!.reasons).toEqual(['email', 'phone'])
  })

  it('keeps the fullest contact first, and the order they came in otherwise', () => {
    const groups = findDuplicateGroups([
      contact('a', { name: 'Ana Ruiz' }),
      contact('b', { name: 'Ana Ruiz', emails: ['ana@example.com'], company: 'Citrus' }),
      contact('c', { name: 'Ana Ruiz' })
    ])

    expect(groups[0]!.contacts.map(item => item.id)).toEqual(['b', 'a', 'c'])
    expect(groups[0]!.merged.id).toBe('b')
    expect(groups[0]!.key).toBe('b|a|c')
  })

  it('does not group a contact with itself over a repeated address', () => {
    expect(findDuplicateGroups([contact('a', { emails: ['a@example.com', 'A@example.com'] })])).toEqual([])
  })
})

describe('mergeContacts', () => {
  it('keeps the first contact’s place and takes the union of the rest', () => {
    const merged = mergeContacts([
      contact('a', { bookId: 'one', name: 'Ana', emails: ['ana@example.com'], phones: ['600 111 222'], note: 'Met in Lisbon' }),
      contact('b', { bookId: 'two', name: 'Ana Ruiz', emails: ['ANA@example.com', 'ana@work.example'], phones: ['+34 600 111 222', '555 0100'], company: 'Citrus', title: 'Editor', birthday: '1990-04-12' }),
      contact('c', { name: 'A', note: 'Met in Lisbon, likes tea', birthday: '1991-01-01', title: 'Managing editor' })
    ])

    expect(merged).toEqual({
      id: 'a',
      bookId: 'one',
      name: 'Ana Ruiz',
      emails: ['ana@example.com', 'ana@work.example'],
      phones: ['+34 600 111 222', '555 0100'],
      company: 'Citrus',
      title: 'Managing editor',
      note: 'Met in Lisbon, likes tea',
      birthday: '1990-04-12'
    })
  })

  it('leaves out what nobody has', () => {
    const merged = mergeContacts([contact('a', { company: ' ' }), contact('b')])

    expect(merged.company).toBeUndefined()
    expect(merged.birthday).toBeUndefined()
    expect(merged.emails).toEqual([])
  })
})

describe('birthdays', () => {
  const today = new Date(2026, 10, 14)

  it('reads full and year-less dates', () => {
    expect(parseBirthday('1990-04-12')).toEqual({ month: 4, day: 12, year: 1990 })
    expect(parseBirthday('19900412')).toEqual({ month: 4, day: 12, year: 1990 })
    expect(parseBirthday('--04-12')).toEqual({ month: 4, day: 12, year: undefined })
    expect(parseBirthday('--0412')).toEqual({ month: 4, day: 12, year: undefined })
    expect(parseBirthday('1604-04-12')).toEqual({ month: 4, day: 12, year: undefined })
    expect(parseBirthday('spring')).toBeNull()
    expect(parseBirthday(undefined)).toBeNull()
  })

  it('lists the next thirty days, soonest first, with the age when known', () => {
    const upcoming = upcomingBirthdays([
      contact('far', { birthday: '1980-03-01' }),
      contact('soon', { birthday: '1992-11-26' }),
      contact('today', { birthday: '--11-14' }),
      contact('tomorrow', { birthday: '2000-11-15' }),
      contact('none')
    ], today)

    expect(upcoming.map(item => item.contact.id)).toEqual(['today', 'tomorrow', 'soon'])
    expect(upcoming.map(birthdayLabel)).toEqual(['today', 'tomorrow · turns 26', 'in 12 days · turns 34'])
  })

  it('wraps around the end of the year', () => {
    const [next] = upcomingBirthdays([contact('a', { birthday: '1990-01-02' })], new Date(2026, 11, 20))

    expect(next!.inDays).toBe(13)
    expect(next!.turns).toBe(37)
  })

  it('keeps 29 February on the 28th in a year without one', () => {
    const [next] = upcomingBirthdays([contact('a', { birthday: '2000-02-29' })], new Date(2027, 1, 20))

    expect(next!.date.getDate()).toBe(28)
    expect(next!.inDays).toBe(8)
  })
})
