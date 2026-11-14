import { describe, expect, it } from 'vitest'
import { attachmentMention, composeGuards, greetingName, wrongName } from '../app/utils/compose-guards'

const ben = { name: 'Ben Carter', address: 'ben@example.com' }
const base = { subject: 'Budget', text: 'Hi Ben,\n\nHere are the numbers.', attachments: 0, recipients: [ben], knownNames: ['Ana Lima', 'Ben Carter'] }

describe('send guards', () => {
  it('lets an ordinary message through', () => {
    expect(composeGuards(base)).toEqual([])
  })

  it('notices a mention of an attachment when nothing is attached', () => {
    expect(attachmentMention('Please find the report attached.')).toBe('attached')
    expect(attachmentMention('See the file for details')).toBe('See the file')
    expect(composeGuards({ ...base, text: 'I attach the invoice.' }).map(issue => issue.kind)).toEqual(['attachment'])
    expect(composeGuards({ ...base, text: 'I attach the invoice.', attachments: 1 })).toEqual([])
  })

  it('knows a few other languages', () => {
    expect(attachmentMention('Anbei die Rechnung')).toBe('Anbei')
    expect(attachmentMention('Vous trouverez le devis en pièce jointe.')).toBe('en pièce jointe')
    expect(attachmentMention('Le adjunto el contrato')).toBe('adjunto')
    expect(attachmentMention('In allegato il preventivo')).toBe('In allegato')
  })

  it('only matches whole words', () => {
    expect(attachmentMention('Our attaché will call you')).toBeUndefined()
    expect(attachmentMention('I feel no attachments to it')).toBe('attachments')
    expect(attachmentMention('reattached the handle')).toBeUndefined()
  })

  it('asks about an empty subject', () => {
    expect(composeGuards({ ...base, subject: '  ' }).map(issue => issue.kind)).toEqual(['subject'])
  })

  it('reads the name a message opens with', () => {
    expect(greetingName('Hi Ana,\n\nThanks')).toBe('Ana')
    expect(greetingName('\nGood morning Ben!')).toBe('Ben')
    expect(greetingName('Dear Ana')).toBe('Ana')
    expect(greetingName('Hi there, Ana')).toBeUndefined()
    expect(greetingName('Thanks Ana,')).toBeUndefined()
    expect(greetingName('hi ana,')).toBeUndefined()
  })

  it('flags a greeting to a known person who isn’t a recipient', () => {
    expect(wrongName({ ...base, text: 'Hi Ana,\n\nHere you go.' })).toBe('Ana')
    const [issue] = composeGuards({ ...base, text: 'Hi Ana,\n\nHere you go.' })
    expect(issue?.kind).toBe('name')
    expect(issue?.detail).toContain('Ben Carter')
  })

  it('stays quiet when the name could be a recipient or isn’t someone known', () => {
    expect(wrongName({ ...base, text: 'Hi Ben,' })).toBeUndefined()
    // Only the address carries the name
    expect(wrongName({ ...base, text: 'Hi Ana,', recipients: [{ address: 'ana.lima@example.com' }] })).toBeUndefined()
    expect(wrongName({ ...base, text: 'Hi Ana,', recipients: [{ address: 'analima@example.com' }] })).toBeUndefined()
    // A name nobody you know goes by: a nickname, a title, a team
    expect(wrongName({ ...base, text: 'Hi Team,' })).toBeUndefined()
    expect(wrongName({ ...base, text: 'Dear Sir,' })).toBeUndefined()
    // Accents don't make a different person
    expect(wrongName({ ...base, text: 'Hi José,', recipients: [{ name: 'Jose Ruiz', address: 'j@example.com' }], knownNames: ['José Ruiz'] })).toBeUndefined()
    expect(wrongName({ ...base, text: 'Hi Ana,', recipients: [] })).toBeUndefined()
  })

  it('lists everything it found, in a steady order', () => {
    const issues = composeGuards({ ...base, subject: '', text: 'Hi Ana,\n\nSee the attached file.' })
    expect(issues.map(issue => issue.kind)).toEqual(['attachment', 'subject', 'name'])
  })
})
