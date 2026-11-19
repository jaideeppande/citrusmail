import { describe, expect, it } from 'vitest'
import { groupThreads, inboxCategory, isMachineSender, snoozePresets, threadSubject } from '../app/utils/threads'

// The auto-import the util leans on
const scope = globalThis as { personName?: unknown }
scope.personName = (address?: { name?: string, address: string }) => address?.name?.trim() || address?.address || 'Unknown sender'

const message = (id: string, subject: string, date: string, extra: Partial<MessageSummary> = {}): MessageSummary => ({
  id, folder: 'INBOX', subject, from: { address: 'ana@example.com', name: 'Ana Ruiz' }, to: [], date, preview: '', unread: false, flagged: false, hasAttachments: false, ...extra
})

describe('threadSubject', () => {
  it('takes reply and forward marks off the front, in several languages', () => {
    expect(threadSubject('RE: Fwd: Q4  budget ')).toBe('q4 budget')
    expect(threadSubject('AW: WG: Termin')).toBe('termin')
    expect(threadSubject('Re[2]: Invoice')).toBe('invoice')
  })

  it('leaves a subject that only looks like one alone', () => {
    expect(threadSubject('Report: Q4')).toBe('report: q4')
    expect(threadSubject('Return policy')).toBe('return policy')
  })
})

describe('groupThreads', () => {
  it('puts replies under one head, the newest, oldest first inside', () => {
    const threads = groupThreads([
      message('3', 'Re: Q4 budget', '2026-01-03', { unread: true }),
      message('2', 'Lunch?', '2026-01-02'),
      message('1', 'Q4 budget', '2026-01-01', { hasAttachments: true })
    ])
    expect(threads.map(thread => thread.head.id)).toEqual(['3', '2'])
    expect(threads[0]!.messages.map(item => item.id)).toEqual(['1', '3'])
    expect(threads[0]!.unread).toBe(true)
    expect(threads[0]!.hasAttachments).toBe(true)
  })

  it('never joins messages with no subject, or from different folders', () => {
    expect(groupThreads([message('1', '', '2026-01-01'), message('2', 'Re:', '2026-01-02')])).toHaveLength(2)
    expect(groupThreads([message('1', 'Hi', '2026-01-01'), message('1', 'Hi', '2026-01-02', { folder: 'Archive' })])).toHaveLength(2)
  })
})

describe('split inbox', () => {
  it('tells machines from people by the address', () => {
    expect(isMachineSender('no-reply@shop.example')).toBe(true)
    expect(isMachineSender('notifications+abc@github.example')).toBe(true)
    expect(isMachineSender('noreen@example.com')).toBe(false)
    expect(isMachineSender('alerta@example.com')).toBe(false)
  })

  it('files a mailing list under newsletters even when it looks like a machine', () => {
    const lists = new Set(['updates@news.example'])
    expect(inboxCategory(message('1', 'x', '2026-01-01', { from: { address: 'Updates@news.example' } }), lists)).toBe('newsletters')
    expect(inboxCategory(message('1', 'x', '2026-01-01', { from: { address: 'billing@shop.example' } }), lists)).toBe('notifications')
    expect(inboxCategory(message('1', 'x', '2026-01-01'), lists)).toBe('people')
  })
})

describe('snoozePresets', () => {
  it('only offers later today while there is one', () => {
    expect(snoozePresets(new Date(2026, 0, 5, 9)).map(preset => preset.label)).toEqual(['Later today', 'This evening', 'Tomorrow morning', 'Next week'])
    expect(snoozePresets(new Date(2026, 0, 5, 20)).map(preset => preset.label)).toEqual(['Tomorrow morning', 'Next week'])
  })

  it('skips next week on a Sunday, when it is tomorrow', () => {
    expect(snoozePresets(new Date(2026, 0, 4, 20)).map(preset => preset.label)).toEqual(['Tomorrow morning'])
  })
})
