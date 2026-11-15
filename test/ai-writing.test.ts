import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import {
  applyBlockSegments, autocompletePrompt, blockSegments, cleanCompletion, cleanSubjects, diffChanges, docFromRuns, docRuns,
  draftPrompt, draftSystem, followUpPrompt, freeSlotsAhead, holdsNoMeeting, looksLikeMeetingAsk, meetingPrompt, parseSegments,
  rewritePrompt, segmentsPrompt, splitDraftAnswer, textToHtmlBlocks, textToNodes, wordCount, wordDiff
} from '../app/utils/ai-writing'

const p = (text: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(marks ? { marks } : {}) }] : [] })
const table: JSONContent = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p('cell words')] }] }] }
const image: JSONContent = { type: 'image', attrs: { src: 'data:image/png;base64,AAA' } }
const code: JSONContent = { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'let teh = 1' }] }
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

describe('blockSegments and applyBlockSegments (proofreading)', () => {
  const source = doc(
    p('Hi Ana,'),
    p('Thanks for teh notes.', [{ type: 'bold' }]),
    table,
    { type: 'bulletList', content: [{ type: 'listItem', content: [p('frist item')] }] },
    code,
    image,
    { type: 'blockquote', content: [p('quoted teh words')] },
    p('')
  )

  it('sends the words of paragraphs and list items only, never tables, code, pictures or quotes', () => {
    expect(blockSegments(source)).toEqual(['Hi Ana,', 'Thanks for teh notes.', 'frist item'])
  })

  it('puts corrections back in place and leaves every other node as it was', () => {
    const fixed = applyBlockSegments(source, ['Hi Ana,', 'Thanks for the notes.', 'first item'])
    expect(fixed.content![0]).toBe(source.content![0])
    expect(fixed.content![1]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Thanks for the notes.' }] })
    expect(fixed.content![2]).toBe(table)
    expect(fixed.content![3]!.content![0]!.content![0]).toEqual(p('first item'))
    expect(fixed.content![4]).toBe(code)
    expect(fixed.content![5]).toBe(image)
    expect(fixed.content![6]).toBe(source.content![6])
  })

  it('keeps line breaks as breaks', () => {
    const withBreak = doc({ type: 'paragraph', content: [{ type: 'text', text: 'one' }, { type: 'hardBreak' }, { type: 'text', text: 'two' }] })
    expect(blockSegments(withBreak)).toEqual(['one\ntwo'])
    expect(applyBlockSegments(withBreak, ['one\ntoo']).content![0]!.content).toEqual([{ type: 'text', text: 'one' }, { type: 'hardBreak' }, { type: 'text', text: 'too' }])
  })
})

describe('docRuns and docFromRuns (tone rewrite)', () => {
  it('cuts the draft into runs of words around the parts that stay', () => {
    const source = doc(p('Hello Ben,'), p(''), p('Here are the numbers.'), table, p('Thoughts?'), image, p(''))
    const { runs, layout } = docRuns(source)
    expect(runs).toEqual(['Hello Ben,\n\nHere are the numbers.', 'Thoughts?'])
    const rebuilt = docFromRuns(layout, ['Hi Ben,\n\nThe numbers:', 'What do you think?'])
    expect(rebuilt.content).toEqual([p('Hi Ben,'), p('The numbers:'), table, p('What do you think?'), image, p('')])
  })

  it('writes simple lists as lines and reads them back as lists', () => {
    const source = doc(p('Bring:'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('tea')] }, { type: 'listItem', content: [p('cake')] }] })
    const { runs, layout } = docRuns(source)
    expect(runs).toEqual(['Bring:\n\n- tea\n- cake'])
    const rebuilt = docFromRuns(layout, ['Please bring:\n- tea\n- biscuits'])
    expect(rebuilt.content![0]).toEqual(p('Please bring:'))
    expect(rebuilt.content![1]!.type).toBe('bulletList')
    expect(rebuilt.content![1]!.content!.map(item => item.content![0]!.content![0]!.text)).toEqual(['tea', 'biscuits'])
  })

  it('keeps an unchanged paragraph’s own node, with its bold, and a run with no answer as it was', () => {
    const bold = p('Same words', [{ type: 'bold' }])
    const source = doc(bold, p('Other words'), table, p('Last'))
    const { layout } = docRuns(source)
    const rebuilt = docFromRuns(layout, ['Same words\n\nNew words', undefined])
    expect(rebuilt.content![0]).toBe(bold)
    expect(rebuilt.content![1]).toEqual(p('New words'))
    expect(rebuilt.content![3]).toBe(source.content![3])
  })

  it('turns plain text into nodes', () => {
    expect(textToNodes('A\nB\n\n1. one\n2. two')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'A' }, { type: 'hardBreak' }, { type: 'text', text: 'B' }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [p('one')] }, { type: 'listItem', content: [p('two')] }] }
    ])
  })
})

describe('textToHtmlBlocks', () => {
  it('makes paragraphs and lists, escaping what the model wrote', () => {
    expect(textToHtmlBlocks('Hi <b>Ana</b>,\n\nHow about:\n- Tue 10:00\n- Wed 14:00')).toBe('<p>Hi &lt;b&gt;Ana&lt;/b&gt;,</p><p>How about:</p><ul><li><p>Tue 10:00</p></li><li><p>Wed 14:00</p></li></ul>')
  })
})

describe('numbered parts', () => {
  it('numbers several parts and leaves one alone', () => {
    expect(segmentsPrompt(['one'])).toBe('one')
    expect(segmentsPrompt(['one', 'two'])).toBe('⟦1⟧\none\n\n⟦2⟧\ntwo')
    expect(rewritePrompt(['one', 'two'], 'Shorter')).toContain('The change to make: Shorter')
  })

  it('reads them back, in any spacing, ignoring parts that don’t exist', () => {
    expect(parseSegments('⟦1⟧ One.\n⟦2⟧\nTwo.\n⟦7⟧ x', 2)).toEqual(['One.', 'Two.'])
    expect(parseSegments('⟦2⟧ Two.', 2)).toEqual([undefined, 'Two.'])
    expect(parseSegments('Just this', 1)).toEqual(['Just this'])
    expect(parseSegments('A.\n\nB.', 2)).toEqual(['A.', 'B.'])
    expect(parseSegments('A. B.', 2)).toEqual([undefined, undefined])
  })
})

describe('wordDiff', () => {
  it('finds the changed words', () => {
    const parts = wordDiff('Thanks for teh notes  yesterday', 'Thanks for the notes yesterday.')
    expect(parts).toEqual([
      { type: 'same', text: 'Thanks for' },
      { type: 'removed', text: 'teh' },
      { type: 'added', text: 'the' },
      { type: 'same', text: 'notes' },
      { type: 'removed', text: 'yesterday' },
      { type: 'added', text: 'yesterday.' }
    ])
    expect(diffChanges(parts)).toEqual([{ before: 'teh', after: 'the' }, { before: 'yesterday', after: 'yesterday.' }])
  })

  it('says nothing changed when only spacing did', () => {
    expect(diffChanges(wordDiff('a  b', 'a b'))).toEqual([])
  })

  it('lists words only added or only removed', () => {
    expect(diffChanges(wordDiff('I going', 'I am going'))).toEqual([{ before: '', after: 'am' }])
    expect(diffChanges(wordDiff('the the end', 'the end'))).toEqual([{ before: 'the', after: '' }])
  })
})

describe('drafts', () => {
  it('asks for a subject line only when there is none', () => {
    expect(draftSystem({ email: 'me@x.com', name: 'Mo' }, true)).toContain('“Subject: ”')
    expect(draftSystem({ email: 'me@x.com' }, false)).toContain('no subject line')
    expect(draftPrompt({ instruction: 'move lunch to friday', to: [{ name: 'Ana Ruiz', address: 'ana@x.com' }], subject: '' }))
      .toBe('To: Ana Ruiz <ana@x.com>\n\nWhat the email should say: move lunch to friday')
  })

  it('holds the subject line back while it streams in', () => {
    expect(splitDraftAnswer('Sub', true)).toEqual({ body: '', settled: false })
    expect(splitDraftAnswer('Subject: Lunch on Fri', true)).toEqual({ body: '', settled: false })
    expect(splitDraftAnswer('Subject: “Lunch on Friday.”\n\nHi Ana,', true)).toEqual({ subject: 'Lunch on Friday', body: 'Hi Ana,', settled: true })
    expect(splitDraftAnswer('Hi Ana,', true)).toEqual({ body: 'Hi Ana,', settled: true })
    expect(splitDraftAnswer('Subject: x', false).body).toBe('Subject: x')
  })

  it('cleans subject suggestions', () => {
    expect(cleanSubjects(['"Lunch moved to Friday."', 'lunch moved to friday', 'Subject: One two three four five six seven eight nine', ''])).toEqual(['Lunch moved to Friday', 'One two three four five six seven eight'])
    expect(wordCount('Hi Ana, — thanks! 12 more')).toBe(5)
  })

  it('follows up with the original in the prompt', () => {
    const prompt = followUpPrompt({ to: [{ address: 'b@x.com' }], subject: 'Quote', days: 4, original: 'Could you send the quote?' })
    expect(prompt).toBe('To: b@x.com\nSent 4 days ago, no answer since.\n\nTheir message:\n\nSubject: Quote\n\nCould you send the quote?')
  })
})

describe('meeting replies', () => {
  it('notices a message that asks to meet', () => {
    expect(looksLikeMeetingAsk('Are you free for a call next week?')).toBe(true)
    expect(looksLikeMeetingAsk('Können wir einen Termin finden?')).toBe(true)
    expect(looksLikeMeetingAsk('Here is the invoice for October.')).toBe(false)
  })

  it('holds back an answer that may be the no-meeting word', () => {
    expect(holdsNoMeeting('NO_ME')).toBe(true)
    expect(holdsNoMeeting('NO_MEETING')).toBe(true)
    expect(holdsNoMeeting('Hi Ana')).toBe(false)
  })

  it('sends free times, not events', () => {
    expect(meetingPrompt(['Tue 17 Nov, 10:00 – 11:00'], 'From: a')).toBe('The writer\'s free times:\n- Tue 17 Nov, 10:00 – 11:00\n\nThe email being replied to:\n\nFrom: a')
  })

  // Local times throughout: the slots are the writer's own working hours
  const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute)
  const event = (day: number, from: [number, number], to: [number, number], allDay = false) => ({ start: local(day, ...from).toISOString(), end: local(day, ...to).toISOString(), allDay })

  it('finds the gaps in the next five working days, skipping the weekend', () => {
    // Friday 13 November 2026, 17:05: today has nothing left worth offering
    const slots = freeSlotsAhead([
      event(16, [10, 0], [11, 0]),
      event(16, [10, 30], [12, 0]),
      event(16, [17, 10], [18, 0]),
      event(17, [8, 0], [9, 15]),
      event(18, [0, 0], [23, 59], true)
    ], local(13, 17, 5))
    const days = new Set(slots.map(slot => slot.start.getDate()))
    expect([...days]).toEqual([16, 17, 18, 19, 20])
    expect(slots.filter(slot => slot.start.getDate() === 16).map(slot => [slot.start.getHours() * 60 + slot.start.getMinutes(), slot.end.getHours() * 60 + slot.end.getMinutes()]))
      .toEqual([[540, 600], [720, 1030]])
    // 9:15 to 9:30 is too short a gap before nothing: the day starts after the event
    expect(slots.find(slot => slot.start.getDate() === 17)!.start.getHours() * 60 + slots.find(slot => slot.start.getDate() === 17)!.start.getMinutes()).toBe(555)
    // An all-day event doesn't block the day
    expect(slots.find(slot => slot.start.getDate() === 18)).toMatchObject({ start: local(18, 9), end: local(18, 17, 30) })
  })

  it('starts today from the next half hour', () => {
    const slots = freeSlotsAhead([], local(16, 10, 5))
    expect(slots[0]).toMatchObject({ start: local(16, 10, 30), end: local(16, 17, 30) })
    expect(slots).toHaveLength(5)
  })
})

describe('autocomplete', () => {
  it('sends the subject, two paragraphs before and the one being typed', () => {
    expect(autocompletePrompt({ subject: 'Lunch', before: ['Hi Ana,'], paragraph: 'Would Friday' }))
      .toBe('Subject: Lunch\n\nEarlier paragraphs:\nHi Ana,\n\nThe paragraph being typed (continue it):\nWould Friday')
  })

  it('cleans the completion into ghost text', () => {
    expect(cleanCompletion(' work for you?\nMore', 'Would Friday')).toBe(' work for you?')
    expect(cleanCompletion('"work for you?"', 'Would Friday ')).toBe('work for you?')
    expect(cleanCompletion('ing to the meeting', 'I am go')).toBe('ing to the meeting')
    expect(cleanCompletion('See you then', 'Thanks.')).toBe(' See you then')
    expect(cleanCompletion('Would Friday work', 'Would Friday')).toBe(' work')
    expect(cleanCompletion('one two three four five six seven eight nine ten eleven twelve thirteen', 'Hi ')).toBe('one two three four five six seven eight nine ten eleven twelve')
    expect(cleanCompletion('   ', 'Hi')).toBe('')
  })
})
