import { describe, expect, it } from 'vitest'
import { isEmptySearch, matchesSearch, parseSearch } from '../app/utils/labels'

const message = (date: string, unread = false) => ({ id: '1', folder: 'INBOX', subject: '', from: { address: 'a@b.c' }, to: [], date, preview: '', unread, flagged: false, hasAttachments: false }) as MessageSummary

describe('parseSearch', () => {
  it('takes operators out of the words', () => {
    expect(parseSearch('budget from:ana has:attachment is:unread q4')).toEqual({ text: 'budget q4', from: 'ana', attachments: true, unread: true })
  })

  it('reads quoted values and phrases', () => {
    expect(parseSearch('from:"Ana Ruiz" "travel line" in:"Clients/Acme"')).toEqual({ text: 'travel line', from: 'Ana Ruiz', folder: 'Clients/Acme' })
  })

  it('reads day bounds, and leaves a date it cannot read as a word', () => {
    expect(parseSearch('after:2026-01-01 before:2026-01-31')).toEqual({ text: '', after: '2026-01-01', before: '2026-01-31' })
    expect(parseSearch('before:yesterday').text).toBe('before:yesterday')
  })

  it('keeps operators it does not know, and things that only look like one', () => {
    expect(parseSearch('re: invoice size:big').text).toBe('re: invoice size:big')
    expect(parseSearch('is:important').text).toBe('is:important')
  })

  it('knows flagged by both names, and read as not unread', () => {
    expect(parseSearch('is:starred').flagged).toBe(true)
    expect(parseSearch('is:read').unread).toBe(false)
  })
})

describe('isEmptySearch', () => {
  it('is empty for spaces and not for an operator alone', () => {
    expect(isEmptySearch(parseSearch('   '))).toBe(true)
    expect(isEmptySearch(parseSearch('is:flagged'))).toBe(false)
    expect(isEmptySearch(parseSearch('is:read'))).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('holds a message to the day bounds, inclusive', () => {
    const query = parseSearch('after:2026-01-10 before:2026-01-12')
    expect(matchesSearch(message('2026-01-10T00:00:00Z'), query)).toBe(true)
    expect(matchesSearch(message('2026-01-12T23:59:00Z'), query)).toBe(true)
    expect(matchesSearch(message('2026-01-13T00:00:00Z'), query)).toBe(false)
    expect(matchesSearch(message('2026-01-09T12:00:00Z'), query)).toBe(false)
  })

  it('drops unread mail from is:read', () => {
    expect(matchesSearch(message('2026-01-10T00:00:00Z', true), parseSearch('is:read'))).toBe(false)
  })
})
