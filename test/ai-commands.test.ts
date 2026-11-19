import { describe, expect, it } from 'vitest'
import { AI_COMMAND_CAP, aiPlanSchema, changesMessage, commandRequest, describePlan, findFolder, matchesPlan, planNotes, planQueries, planWithin, resolvePlan, snoozeUntil } from '../app/utils/ai-commands'
import type { AiPlan, AiPlanAnswer, AiPlanContext } from '../app/utils/ai-commands'
import { answerBlocks, askThreadMessages, threadForPrompt } from '../app/utils/ai-assistant'
import { aiRuleSchema, ruleFromAi } from '../app/utils/ai-rules'

const folder = (path: string, role?: FolderRole, name = path) => ({ path, name, role, unread: 0, depth: 0 }) as Folder

const folders = [
  folder('INBOX', 'inbox', 'Inbox'),
  folder('Archive', 'archive'),
  folder('Sent', 'sent'),
  folder('Drafts', 'drafts'),
  folder('Trash', 'trash'),
  folder('Junk', 'junk', 'Spam'),
  folder('Flagged', 'flagged'),
  folder('Receipts'),
  folder('Clients/Acme', undefined, 'Acme')
]

// A Sunday morning
const now = new Date(2026, 10, 15, 9, 30)

const context: AiPlanContext = { folders, labels: [{ id: 'l1', name: 'Work' }, { id: 'l2', name: 'Travel' }], now, request: 'archive github mail' }

const plan = (answer: Partial<AiPlanAnswer> & { action: string }, request = context.request) => resolvePlan(aiPlanSchema.parse(answer), { ...context, request })

const message = (change: Partial<MessageSummary> = {}) => ({ id: '1', folder: 'INBOX', subject: 'Hi', from: { address: 'a@b.c' }, to: [], date: '2026-11-10T10:00:00.000Z', preview: '', unread: false, flagged: false, hasAttachments: false, ...change }) as MessageSummary

const state = { isPinned: () => false, onLater: () => false, hasLabel: () => false, folders }

describe('findFolder', () => {
  it('finds a folder by name, path or role word, whatever the case', () => {
    expect(findFolder('receipts', folders)?.path).toBe('Receipts')
    expect(findFolder('Clients/Acme', folders)?.path).toBe('Clients/Acme')
    expect(findFolder('acme', folders)?.path).toBe('Clients/Acme')
    expect(findFolder('spam', folders)?.path).toBe('Junk')
    expect(findFolder('Bin', folders)?.path).toBe('Trash')
  })

  it('never guesses, and never picks the virtual Flagged folder', () => {
    expect(findFolder('Receipt', folders)).toBeUndefined()
    expect(findFolder('Rec', folders)).toBeUndefined()
    expect(findFolder('Flagged', folders)).toBeUndefined()
    expect(findFolder('', folders)).toBeUndefined()
  })
})

describe('resolvePlan', () => {
  it('reads an ordinary plan', () => {
    const { plan: result, errors } = plan({ action: 'archive', search: { from: 'github.com', since: '2026-11-08', before: '2026-11-15' } })
    expect(errors).toEqual([])
    expect(result!.action).toEqual({ kind: 'archive' })
    expect(result!.search.from).toBe('github.com')
    expect(result!.search.since).toBe('2026-11-08')
  })

  it('never searches Trash, Junk, Drafts or the virtual Flagged folder unless one is named', () => {
    const paths = plan({ action: 'delete', search: { from: 'x' } }).plan!.search.folders.map(item => item.path)
    expect(paths).not.toContain('Trash')
    expect(paths).not.toContain('Junk')
    expect(paths).not.toContain('Drafts')
    expect(paths).not.toContain('Flagged')
    expect(paths).toContain('INBOX')
    expect(plan({ action: 'delete', search: { folder: 'Trash', from: 'x' } }).plan!.search.folders.map(item => item.path)).toEqual(['Trash'])
  })

  it('leaves the destination out of the search', () => {
    expect(plan({ action: 'archive', search: { from: 'x' } }).plan!.search.folders.some(item => item.role === 'archive')).toBe(false)
    expect(plan({ action: 'move', folder: 'Receipts', search: { from: 'x' } }).plan!.search.folders.some(item => item.path === 'Receipts')).toBe(false)
  })

  it('turns down actions that are not on the list', () => {
    for (const action of ['forward', 'reply', 'deleteAll', 'DELETE', '', 'archive; delete', 'eval']) {
      const result = plan({ action, search: { from: 'x' } })
      expect(result.plan).toBeUndefined()
      expect(result.errors[0]).toMatch(/can’t/)
    }
    expect(plan({ action: 'unsupported', explain: 'Replying isn’t possible.' }).errors[0]).toContain('Replying isn’t possible.')
  })

  it('names unknown folders and labels as errors instead of guessing', () => {
    expect(plan({ action: 'move', folder: 'Reciepts', search: { from: 'x' } }).errors).toEqual(['There’s no folder called “Reciepts”.'])
    expect(plan({ action: 'move', search: { from: 'x' } }).errors[0]).toMatch(/which folder/)
    expect(plan({ action: 'archive', search: { folder: 'Newsletters' } }).errors).toEqual(['There’s no folder called “Newsletters”.'])
    expect(plan({ action: 'none', search: { label: 'Home' } }).errors).toEqual(['There’s no label called “Home”.'])
    expect(plan({ action: 'label', label: 'Urgent', search: { from: 'x' } }).errors).toEqual(['There’s no label called “Urgent”.'])
  })

  it('makes a new label only when the person named it', () => {
    const result = plan({ action: 'label', label: 'Urgent', search: { from: 'boss' } }, 'label mail from my boss urgent')
    expect(result.plan!.action).toEqual({ kind: 'label', label: { name: 'Urgent' } })
    expect(plan({ action: 'label', label: 'work', search: { from: 'x' } }).plan!.action).toEqual({ kind: 'label', label: { id: 'l1', name: 'Work' } })
  })

  it('refuses absurd or impossible dates', () => {
    expect(plan({ action: 'none', search: { since: '1970-01-01' } }).errors[0]).toMatch(/isn’t a date/)
    expect(plan({ action: 'none', search: { since: '9999-01-01' } }).errors[0]).toMatch(/isn’t a date/)
    expect(plan({ action: 'none', search: { since: '2026-02-30' } }).errors[0]).toMatch(/isn’t a date/)
    expect(plan({ action: 'none', search: { since: 'last week' } }).errors[0]).toMatch(/isn’t a date/)
    expect(plan({ action: 'none', search: { since: '2026-11-10', before: '2026-11-01' } }).errors[0]).toMatch(/don’t leave any days/)
  })

  it('refuses snoozes in the past, too far ahead, or unreadable', () => {
    expect(plan({ action: 'snooze', until: '2020-01-01T09:00', search: { from: 'x' } }).errors[0]).toMatch(/isn’t a time/)
    expect(plan({ action: 'snooze', until: '2030-01-01T09:00', search: { from: 'x' } }).errors[0]).toMatch(/isn’t a time/)
    expect(plan({ action: 'snooze', until: 'whenever', search: { from: 'x' } }).errors[0]).toMatch(/isn’t a time/)
    expect(plan({ action: 'snooze', search: { from: 'x' } }).errors[0]).toMatch(/until when/)
    const ok = plan({ action: 'snooze', until: 'tomorrow', search: { from: 'x' } }).plan!.action
    expect(ok.kind === 'snooze' && ok.until).toEqual(new Date(2026, 10, 16, 8, 0))
  })

  it('will not act on all of your mail at once', () => {
    expect(plan({ action: 'delete' }).errors[0]).toMatch(/all of your mail/)
    expect(plan({ action: 'delete', search: {} }).errors[0]).toMatch(/all of your mail/)
    expect(plan({ action: 'delete', search: { words: ['', '  '] } }).errors[0]).toMatch(/all of your mail/)
    // A named folder is a choice, and just looking is always fine
    expect(plan({ action: 'archive', search: { folder: 'Receipts' } }).errors).toEqual([])
    expect(plan({ action: 'none' }).errors).toEqual([])
  })

  it('tidies the search terms', () => {
    const search = plan({ action: 'none', search: { words: ['invoice', 'Invoice ', 'invoice', 'bill', 'receipt', 'total', 'extra'], from: '  ada  ' } }).plan!.search
    expect(search.words).toEqual(['invoice', 'Invoice', 'bill', 'receipt'])
    expect(search.from).toBe('ada')
  })

  it('rejects answers that are not the right shape at all', () => {
    expect(aiPlanSchema.safeParse({ search: { from: 'x' } }).success).toBe(false)
    expect(aiPlanSchema.safeParse({ action: 'archive', search: { unread: 'yes' } }).success).toBe(false)
    expect(aiPlanSchema.safeParse({ action: 'x'.repeat(200) }).success).toBe(false)
  })
})

describe('snoozeUntil', () => {
  it('reads the presets', () => {
    expect(snoozeUntil('laterToday', now)).toEqual(new Date(2026, 10, 15, 12, 30))
    expect(snoozeUntil('thisEvening', now)).toEqual(new Date(2026, 10, 15, 19, 0))
    expect(snoozeUntil('next week', now)).toEqual(new Date(2026, 10, 16, 8, 0))
    expect(snoozeUntil('2026-11-20', now)).toEqual(new Date(2026, 10, 20, 8, 0))
    expect(snoozeUntil('2026-11-20T14:15', now)).toEqual(new Date(2026, 10, 20, 14, 15))
  })

  it('has no evening once it is over', () => {
    expect(snoozeUntil('thisEvening', new Date(2026, 10, 15, 21, 0))).toBeUndefined()
  })
})

describe('the search', () => {
  const search = (answer: Partial<AiPlanAnswer>) => plan({ action: 'none', ...answer }).plan!.search

  it('asks the list once per phrase', () => {
    expect(planQueries(search({ search: { subject: 'Q4 budget', words: ['spreadsheet'] } }))).toEqual(['Q4 budget', 'spreadsheet'])
    expect(planQueries(search({ search: { from: 'ada' } }))).toEqual([undefined])
  })

  it('narrows by the smallest window that covers the start', () => {
    expect(planWithin(search({ search: { since: '2026-11-12' } }), now)).toBe('week')
    expect(planWithin(search({ search: { since: '2026-10-20' } }), now)).toBe('month')
    expect(planWithin(search({ search: { since: '2026-03-01' } }), now)).toBe('year')
    expect(planWithin(search({ search: { since: '2024-01-01' } }), now)).toBeUndefined()
  })

  it('checks what the server cannot', () => {
    const s = search({ search: { since: '2026-11-08', before: '2026-11-11', unread: false, label: 'Work' } })
    expect(matchesPlan(message(), s, () => true)).toBe(true)
    expect(matchesPlan(message({ date: '2026-11-11T09:00:00.000Z' }), s, () => true)).toBe(false)
    expect(matchesPlan(message({ unread: true }), s, () => true)).toBe(false)
    expect(matchesPlan(message(), s, () => false)).toBe(false)
  })
})

describe('the plan as the person sees it', () => {
  const resolved = (answer: Partial<AiPlanAnswer> & { action: string }, request?: string) => plan(answer, request).plan as AiPlan

  it('says what will happen', () => {
    expect(describePlan(resolved({ action: 'archive', search: { from: 'GitHub', since: '2026-11-08' } }), 23)).toBe('Archive 23 messages from GitHub sent since 8 Nov 2026')
    expect(describePlan(resolved({ action: 'markRead', search: { unread: true, folder: 'Receipts' } }), 1)).toBe('Mark 1 unread message in Receipts as read')
    expect(describePlan(resolved({ action: 'move', folder: 'receipts', search: { words: ['invoice', 'receipt'] } }), 4)).toBe('Move 4 messages mentioning “invoice” or “receipt” to Receipts')
    expect(describePlan(resolved({ action: 'delete', search: { folder: 'Trash', before: '2026-01-01' } }), 9)).toBe('Delete 9 messages in Trash sent before 1 Jan 2026 for good')
    expect(describePlan(resolved({ action: 'snooze', until: '2026-11-20T09:00', search: { from: 'ada' } }), 2)).toBe('Snooze 2 messages from ada until Fri 20 Nov, 09:00')
  })

  it('warns about a lot of mail leaving, and about deleting', () => {
    const many = resolved({ action: 'delete', search: { from: 'x' } })
    expect(planNotes(many, 51)[0]).toMatch(/^This is a lot/)
    expect(planNotes(many, 50).some(note => note.startsWith('This is a lot'))).toBe(false)
    expect(planNotes(resolved({ action: 'move', folder: 'Receipts', search: { from: 'x' } }), 120)[0]).toMatch(/^This is a lot/)
    expect(planNotes(resolved({ action: 'archive', search: { from: 'x' } }), 51)[0]).toMatch(/^This is a lot/)
    expect(planNotes(resolved({ action: 'flag', search: { from: 'x' } }), 150)).toEqual([])
    expect(planNotes(resolved({ action: 'delete', search: { folder: 'Trash', from: 'x' } }), 3)).toContain('Messages deleted from Trash are gone for good.')
    expect(planNotes(resolved({ action: 'label', label: 'Urgent', search: { from: 'x' } }, 'label it urgent'), 3)).toContain('This makes a new label, “Urgent”.')
    expect(planNotes(resolved({ action: 'none', search: { from: 'x' } }), AI_COMMAND_CAP, true)[0]).toMatch(/newest 200/)
  })

  it('leaves off messages the action would not change', () => {
    const archive = resolved({ action: 'archive', search: { from: 'x' } }).action
    expect(changesMessage(archive, message({ folder: 'Archive' }), state)).toBe(false)
    expect(changesMessage(archive, message(), state)).toBe(true)
    expect(changesMessage({ kind: 'markRead' }, message({ unread: false }), state)).toBe(false)
    expect(changesMessage({ kind: 'flag' }, message({ flagged: true }), state)).toBe(false)
    expect(changesMessage({ kind: 'pin' }, message(), { ...state, isPinned: () => true })).toBe(false)
    expect(changesMessage({ kind: 'label', label: { id: 'l1', name: 'Work' } }, message(), { ...state, hasLabel: () => true })).toBe(false)
    expect(changesMessage({ kind: 'label', label: { name: 'New' } }, message(), { ...state, hasLabel: () => true })).toBe(true)
  })
})

describe('commandRequest', () => {
  it('takes three words or more, or anything after >', () => {
    expect(commandRequest('archive github mail', [])).toBe('archive github mail')
    expect(commandRequest('> archive', [])).toBe('archive')
    expect(commandRequest('>', [])).toBeUndefined()
    expect(commandRequest('inbox', [])).toBeUndefined()
    expect(commandRequest('go to inbox', ['Go to inbox'])).toBeUndefined()
  })
})

describe('ask this conversation', () => {
  it('keeps everything when it fits', () => {
    expect(threadForPrompt(['one', 'two', 'three'], 1000)).toBe('one\n\n---\n\ntwo\n\n---\n\nthree')
  })

  it('keeps the newest whole and leaves out the oldest first', () => {
    const big = 'x'.repeat(3000)
    const newest = 'n'.repeat(4000)
    const result = threadForPrompt([big, big, big, newest], 8000)
    expect(result.endsWith(newest)).toBe(true)
    expect(result.length).toBeLessThanOrEqual(8000 + 100)
    expect(result).toMatch(/^\[\d earlier messages? left out\]/)
  })

  it('keeps the newest whole even over the limit', () => {
    const newest = 'n'.repeat(500)
    expect(threadForPrompt(['old', newest], 100)).toBe(`[1 earlier message left out]\n\n---\n\n${newest}`)
  })

  it('sends the conversation with the first question only', () => {
    const messages = askThreadMessages('THREAD', [{ role: 'user', content: 'When?' }, { role: 'assistant', content: 'Friday' }, { role: 'user', content: 'Where?' }])
    expect(messages[0]!.content).toContain('THREAD')
    expect(messages[0]!.content).toContain('Question: When?')
    expect(messages[2]).toEqual({ role: 'user', content: 'Where?' })
  })

  it('lays out answers as paragraphs and lists, never markup', () => {
    expect(answerBlocks('First line\n\n- one\n- two\nAfter <b>bold</b>')).toEqual([
      { kind: 'paragraph', text: 'First line' },
      { kind: 'list', items: ['one', 'two'] },
      { kind: 'paragraph', text: 'After <b>bold</b>' }
    ])
  })
})

describe('rules in plain English', () => {
  const rule = (answer: unknown) => ruleFromAi(aiRuleSchema.parse(answer), folders, 'r1')

  it('fills the rule from the answer, on an existing folder', () => {
    const { rule: made, notes } = rule({ match: 'any', conditions: [{ field: 'subject', value: 'receipt' }, { field: 'Subject', value: 'your order' }, { field: 'subject', value: 'receipt' }], folder: 'receipts', markRead: true, leftOut: '' })
    expect(made).toMatchObject({ id: 'r1', match: 'any', folder: 'Receipts', markRead: true, createFolder: false })
    expect(made.conditions).toEqual([{ field: 'subject', value: 'receipt' }, { field: 'subject', value: 'your order' }])
    expect(notes).toEqual([])
  })

  it('makes a folder that does not exist, and says so', () => {
    const { rule: made, notes } = rule({ conditions: [{ field: 'from', value: 'shop.com' }], folder: 'Shopping' })
    expect(made).toMatchObject({ folder: 'Shopping', createFolder: true, match: 'all' })
    expect(notes[0]).toMatch(/no folder called “Shopping”/)
  })

  it('says plainly what a rule cannot do', () => {
    const { rule: made, notes } = rule({ conditions: [{ field: 'attachment', value: 'pdf' }, { field: 'from', value: 'bank' }], folder: 'Archive', leftOut: 'Rules can’t check attachments.' })
    expect(made.conditions).toEqual([{ field: 'from', value: 'bank' }])
    expect(notes.join(' ')).toMatch(/attachment “pdf”/)
    expect(notes.join(' ')).toMatch(/Left out: Rules can’t check attachments/)
  })

  it('never files into the Inbox, and asks for a condition when none is left', () => {
    const { rule: made, notes } = rule({ conditions: [{ field: 'body', value: 'hello' }], folder: 'Inbox' })
    expect(made.folder).toBe('')
    expect(made.conditions).toEqual([{ field: 'from', value: '' }])
    expect(notes.join(' ')).toMatch(/out of your Inbox/)
    expect(notes.join(' ')).toMatch(/at least one condition/)
  })
})
