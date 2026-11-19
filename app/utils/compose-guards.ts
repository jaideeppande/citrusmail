// What the composer checks before a message goes out: the slips people only
// notice after pressing Send. Pure functions, so they can be tested on their own

export interface GuardInput {
  subject: string
  /** Your own words as plain text, without the signature or the quoted original */
  text: string
  /** Files attached, plus pictures placed in the message itself */
  attachments: number
  recipients: { name?: string, address: string }[]
  /** Names of people you know: contacts and those you've written to */
  knownNames?: string[]
}

export interface GuardIssue {
  kind: 'attachment' | 'subject' | 'name'
  title: string
  detail: string
}

// Whole words only: "attach" must not match inside "attaché", nor "adjunto" inside a longer word
const ATTACHMENT_WORDS = [
  'attach', 'attached', 'attaching', 'attachment', 'attachments', 'enclosed', 'see the file',
  // German, French, Spanish, Italian
  'anbei', 'im anhang', 'en pièce jointe', 'pièce jointe', 'ci-joint', 'ci-jointe', 'adjunto', 'adjunta', 'allegato', 'in allegato'
]
const ATTACHMENT = new RegExp(`(?<![\\p{L}\\p{N}])(${ATTACHMENT_WORDS.map(word => word.replace(/[-\s]/g, '[-\\s]')).join('|')})(?![\\p{L}\\p{N}])`, 'iu')

/** The word that speaks of an attachment, if the text has one */
export function attachmentMention(text: string): string | undefined {
  return text.match(ATTACHMENT)?.[1]
}

const GREETINGS = new Set(['hi', 'hello', 'hey', 'dear', 'morning', 'good morning', 'good afternoon', 'good evening', 'hallo', 'liebe', 'lieber', 'bonjour', 'salut', 'hola', 'ciao', 'olá'])
// "Hi Ana," alone on the first line: a greeting word, then one capitalised name
const GREETING = /^\s*(\p{L}+(?:\s(?:morning|afternoon|evening))?)\s+(\p{Lu}[\p{L}'’-]+)\s*[,!:.]?\s*$/u

/** The first name a message opens with ("Hi Ana," gives Ana) */
export function greetingName(text: string): string | undefined {
  const first = text.split('\n').find(line => line.trim())
  const match = first?.match(GREETING)
  if (!match || !GREETINGS.has(match[1]!.toLowerCase())) return undefined
  return match[2]
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Whether a first name could be this person's: a word of their name or part of their address */
function couldBe(name: string, person: { name?: string, address: string }): boolean {
  const wanted = fold(name)
  if (fold(person.name ?? '').split(/[^\p{L}\p{N}]+/u).includes(wanted)) return true
  const local = fold(person.address.split('@')[0] ?? '')
  // Short names are too easily part of another word (Al in alice)
  return local.split(/[^\p{L}\p{N}]+/u).includes(wanted) || (wanted.length >= 3 && local.includes(wanted))
}

/**
 * A greeting to someone who isn't getting the message. Deliberately quiet: it
 * only speaks up when the name is a person you know and nobody on the message
 * could go by it
 */
export function wrongName(input: Pick<GuardInput, 'text' | 'recipients' | 'knownNames'>): string | undefined {
  const name = greetingName(input.text)
  if (!name || !input.recipients.length) return undefined
  if (input.recipients.some(person => couldBe(name, person))) return undefined
  const known = (input.knownNames ?? []).some(full => fold(full).split(/\s+/)[0] === fold(name))
  return known ? name : undefined
}

function recipientLabel(recipients: GuardInput['recipients']): string {
  const names = recipients.map(person => person.name?.trim() || person.address)
  if (names.length <= 2) return names.join(' and ')
  return `${names[0]} and ${names.length - 1} others`
}

/** Everything worth a second look, in the order it is shown */
export function composeGuards(input: GuardInput): GuardIssue[] {
  const issues: GuardIssue[] = []

  const word = input.attachments ? undefined : attachmentMention(input.text)
  if (word) issues.push({ kind: 'attachment', title: 'Nothing is attached', detail: `You wrote “${word}”, but the message has no files.` })

  if (!input.subject.trim()) issues.push({ kind: 'subject', title: 'No subject', detail: 'Messages without one are easy to miss.' })

  const name = wrongName(input)
  if (name) issues.push({ kind: 'name', title: `Is this for ${name}?`, detail: `The greeting says “${name}”, but you’re writing to ${recipientLabel(input.recipients)}.` })

  return issues
}
