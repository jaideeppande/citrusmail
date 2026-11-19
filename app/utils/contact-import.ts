import { contactSchema } from '../../shared/utils/schemas'
import { duplicateKeys } from './contact-merge'

// Reading address books other programs wrote (vCard and CSV), and writing
// ours out the same two ways. Pure functions: the import and export dialogs
// only show what these return

/** A contact as a file describes it: no id and no address book yet */
export type ContactDraft = Omit<Contact, 'id' | 'bookId'>

/* ------------------------------------------------------------------ */
/* vCard                                                               */

interface VCardLine {
  name: string
  params: Record<string, string[]>
  value: string
}

// A long line is cut and carried on with a leading space or tab (RFC 6350
// §3.2). vCard 2.1 also cuts quoted-printable values with a trailing `=`
function unfold(text: string): string[] {
  const lines: string[] = []
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1)
    else lines.push(line)
  }

  const joined: string[] = []
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index]!
    const head = line.slice(0, Math.max(0, line.indexOf(':')))
    if (/QUOTED-PRINTABLE/i.test(head)) {
      while (line.endsWith('=') && index + 1 < lines.length) line = line.slice(0, -1) + lines[++index]!
    }
    joined.push(line)
  }
  return joined
}

// `item1.EMAIL;TYPE=INTERNET,HOME;PREF:ana@example.com`. A parameter's value
// may be quoted and hold a colon or a semicolon of its own
function parseLine(line: string): VCardLine | undefined {
  let quoted = false
  let colon = -1
  const cuts: number[] = []
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') quoted = !quoted
    else if (!quoted && char === ';') cuts.push(index)
    else if (!quoted && char === ':') {
      colon = index
      break
    }
  }
  if (colon < 1) return undefined

  const pieces = [...cuts, colon].map((end, index) => line.slice(index ? cuts[index - 1]! + 1 : 0, end))
  // A group prefix (Apple's `item1.`) says nothing we keep
  const name = pieces[0]!.replace(/^.*\./, '').trim().toUpperCase()
  const params: Record<string, string[]> = {}

  for (const piece of pieces.slice(1)) {
    const equals = piece.indexOf('=')
    // vCard 2.1 writes a bare `HOME` or `QUOTED-PRINTABLE` with no name
    const key = equals < 0 ? (/^(QUOTED-PRINTABLE|BASE64|B|8BIT|7BIT)$/i.test(piece.trim()) ? 'ENCODING' : 'TYPE') : piece.slice(0, equals).trim().toUpperCase()
    const values = (equals < 0 ? piece : piece.slice(equals + 1)).split(',').map(value => value.trim().replace(/^"|"$/g, '')).filter(Boolean)
    params[key] = [...(params[key] ?? []), ...values]
  }

  return { name, params, value: line.slice(colon + 1) }
}

function decodeQuotedPrintable(value: string, charset: string | undefined): string {
  const bytes: number[] = []
  for (let index = 0; index < value.length; index++) {
    const hex = value[index] === '=' ? value.slice(index + 1, index + 3) : ''
    if (/^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16))
      index += 2
    } else {
      bytes.push(...new TextEncoder().encode(value[index]!))
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes))
  } catch {
    // A character set this computer has never heard of
    return new TextDecoder().decode(new Uint8Array(bytes))
  }
}

const unescapeText = (value: string) => value.replace(/\\([\\,;:nN])/g, (_, char: string) => char.toLowerCase() === 'n' ? '\n' : char)

/** The parts of a structured value (`N`, `ORG`): cut at each `;` that is not escaped */
function components(value: string): string[] {
  const parts: string[] = ['']
  for (let index = 0; index < value.length; index++) {
    const char = value[index]!
    if (char === '\\' && index + 1 < value.length) parts[parts.length - 1] += char + value[++index]
    else if (char === ';') parts.push('')
    else parts[parts.length - 1] += char
  }
  return parts.map(part => unescapeText(part).trim())
}

/**
 * A birthday as the address book keeps it: `1990-04-12`, or `--04-12` when
 * the year is not said. Anything that is not a date is left out
 */
export function normaliseBirthday(value: string | undefined): string | undefined {
  const text = value?.trim()
  if (!text) return undefined

  const pad = (part: string | number) => String(part).padStart(2, '0')
  const valid = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= 31

  const iso = text.match(/^(\d{4})-?(\d{2})-?(\d{2})(?!\d)/)
  if (iso) return valid(Number(iso[2]), Number(iso[3])) ? `${iso[1]}-${iso[2]}-${iso[3]}` : undefined

  const yearless = text.match(/^--?-?(\d{2})-?(\d{2})$/)
  if (yearless) return valid(Number(yearless[1]), Number(yearless[2])) ? `--${yearless[1]}-${yearless[2]}` : undefined

  // 12.04.1990 is day first wherever dots are used
  const dotted = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotted) return valid(Number(dotted[2]), Number(dotted[1])) ? `${dotted[3]}-${pad(dotted[2]!)}-${pad(dotted[1]!)}` : undefined

  // 4/12/1990 is month first (Outlook's export), unless the first number can only be a day
  const slashed = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashed) {
    const [first, second] = [Number(slashed[1]), Number(slashed[2])]
    const [month, day] = first > 12 ? [second, first] : [first, second]
    return valid(month, day) ? `${slashed[3]}-${pad(month)}-${pad(day)}` : undefined
  }

  return undefined
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (!value || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const optional = (value: string | undefined) => value?.trim() || undefined

function cardToDraft(lines: VCardLine[]): ContactDraft {
  const all = (name: string) => lines.filter(line => line.name === name)
  const first = (name: string) => optional(all(name).map(line => unescapeText(line.value))[0])

  // The address marked as preferred leads: it is the one mail is written to
  const preferred = (line: VCardLine) => line.params.PREF?.length || line.params.TYPE?.some(type => type.toUpperCase() === 'PREF') ? 0 : 1
  const listed = (name: string, scheme: RegExp) => unique(all(name)
    .sort((a, b) => preferred(a) - preferred(b))
    .map(line => unescapeText(line.value).trim().replace(scheme, '')))

  const emails = listed('EMAIL', /^mailto:/i)
  const [family = '', given = '', additional = '', prefix = '', suffix = ''] = components(all('N')[0]?.value ?? '')
  const company = optional(components(all('ORG')[0]?.value ?? '')[0])

  return {
    name: first('FN') || [prefix, given, additional, family, suffix].filter(Boolean).join(' ') || company || emails[0] || '',
    emails,
    phones: listed('TEL', /^tel:/i),
    company,
    title: first('TITLE'),
    note: first('NOTE'),
    birthday: normaliseBirthday(first('BDAY'))
  }
}

/** Every card in a `.vcf` file, whichever version of vCard wrote it */
export function parseVCards(text: string): ContactDraft[] {
  const drafts: ContactDraft[] = []
  let card: VCardLine[] | undefined

  const close = () => {
    if (card?.length) drafts.push(cardToDraft(card))
    card = undefined
  }

  for (const raw of unfold(text)) {
    const line = parseLine(raw)
    if (!line) continue

    if (line.name === 'BEGIN' && line.value.trim().toUpperCase() === 'VCARD') {
      // A card that never said END still counts
      close()
      card = []
    } else if (line.name === 'END' && line.value.trim().toUpperCase() === 'VCARD') {
      close()
    } else if (card) {
      const encoding = line.params.ENCODING?.[0]?.toUpperCase()
      // Pictures and sounds: nothing the address book takes
      if (encoding === 'B' || encoding === 'BASE64') continue
      card.push(encoding === 'QUOTED-PRINTABLE' ? { ...line, value: decodeQuotedPrintable(line.value, line.params.CHARSET?.[0]) } : line)
    }
  }
  close()

  return drafts
}

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

// No line longer than 75 bytes, and never cut in the middle of a character
function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = encoder.encode(char).length
    // A carried-on line spends one of its 75 bytes on the space that marks it
    if (size + width > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  out.push(current)
  return out.join('\r\n ')
}

/** The contacts as one vCard 3.0 file, which every address book reads */
export function contactsToVCard(contacts: ContactDraft[]): string {
  return contacts.map((contact) => {
    const words = contact.name.trim().split(/\s+/)
    const family = words.length > 1 ? words.pop()! : ''

    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeText(contact.name.trim())}`,
      `N:${escapeText(family)};${escapeText(words.join(' '))};;;`,
      ...contact.emails.map((email, index) => `EMAIL;TYPE=INTERNET${index ? '' : ',PREF'}:${escapeText(email)}`),
      ...contact.phones.map(phone => `TEL:${escapeText(phone)}`),
      ...(contact.company ? [`ORG:${escapeText(contact.company)}`] : []),
      ...(contact.title ? [`TITLE:${escapeText(contact.title)}`] : []),
      ...(contact.birthday ? [`BDAY:${escapeText(contact.birthday)}`] : []),
      ...(contact.note ? [`NOTE:${escapeText(contact.note)}`] : []),
      'END:VCARD'
    ].map(fold).join('\r\n')
  }).join('\r\n') + (contacts.length ? '\r\n' : '')
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */

/**
 * The rows of a CSV file. Quoted fields may hold the delimiter, a doubled
 * quote and line breaks; rows with nothing in them are left out
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  // A quote only opens a field at its very start: 5" stays five inches
  let fresh = true

  const endRow = () => {
    row.push(cell)
    if (row.some(value => value.trim())) rows.push(row)
    row = []
    cell = ''
    fresh = true
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"' && fresh) {
      quoted = true
      fresh = false
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
      fresh = true
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index++
      endRow()
    } else {
      cell += char
      fresh = false
    }
  }
  if (cell || row.length) endRow()

  return rows
}

/** Comma, semicolon, tab or bar: whichever cuts the first rows into the same number of columns */
export function detectDelimiter(text: string): string {
  // Enough to judge by, and cut at a line end so the last row is whole
  const sample = text.length > 6000 ? text.slice(0, text.lastIndexOf('\n', 6000) + 1 || 6000) : text
  let best = ','
  let bestScore = 0

  for (const candidate of [',', ';', '\t', '|']) {
    const widths = parseCsv(sample, candidate).slice(0, 12).map(row => row.length)
    if (!widths.length) continue
    const counts = new Map<number, number>()
    for (const width of widths) counts.set(width, (counts.get(width) ?? 0) + 1)
    const [width, times] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!
    const score = width > 1 ? (times / widths.length) * 1000 + width : 0
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

export type CsvField = 'name' | 'first' | 'middle' | 'last' | 'email' | 'phone' | 'company' | 'title' | 'birthday' | 'note' | 'skip'

/** What a column can be filed under, in the order the mapping step offers them */
export const CSV_FIELDS: { value: CsvField, label: string }[] = [
  { value: 'skip', label: 'Don’t import' },
  { value: 'name', label: 'Full name' },
  { value: 'first', label: 'First name' },
  { value: 'middle', label: 'Middle name' },
  { value: 'last', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job title' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'note', label: 'Note' }
]

const squash = (header: string) => header.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

// The column names Google Contacts, Outlook and our own export use
function fieldOf(header: string): CsvField {
  const key = squash(header)
  if (!key) return 'skip'
  // “E-mail 1 - Type”, “Phone 1 - Label”, “E-mail Display Name”: about a value, not one
  if (/(type|label|displayname)$/.test(key) && /email|phone/.test(key)) return 'skip'
  if (/^(name|fullname|displayname|contactname)$/.test(key)) return 'name'
  if (/^(firstname|givenname|first|forename)$/.test(key)) return 'first'
  if (/^(middlename|additionalname|middle)$/.test(key)) return 'middle'
  if (/^(lastname|familyname|surname|last)$/.test(key)) return 'last'
  if (/email/.test(key)) return 'email'
  if (/fax|pager|telex|tty/.test(key)) return 'skip'
  if (/phone|^(mobile|cell|tel|telephone)\d*$/.test(key)) return 'phone'
  if (/^(company|companyname|organi[sz]ation|organi[sz]ation\d*name)$/.test(key)) return 'company'
  if (/^(jobtitle|organi[sz]ation\d*title|position|role)$/.test(key)) return 'title'
  if (/^(birthday|birthdate|dateofbirth|bday)$/.test(key)) return 'birthday'
  if (/^(notes?|comments?|description)$/.test(key)) return 'note'
  return 'skip'
}

/** One field per column, guessed from the header row */
export function guessCsvMapping(headers: string[]): CsvField[] {
  const mapping = headers.map(fieldOf)
  // Outlook's “Title” is Mr or Dr and sits next to “Job Title”; alone, it is the job
  if (!mapping.includes('title')) {
    const index = headers.findIndex(header => squash(header) === 'title')
    if (index >= 0) mapping[index] = 'title'
  }
  // One full name is enough: a second column claiming it would be glued on
  const named = mapping.indexOf('name')
  return mapping.map((field, index) => field === 'name' && index !== named ? 'skip' : field)
}

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_LIKE = /^\+?[\d\s().\-/]{5,}$/

/** Whether the first row names the columns rather than being somebody */
export function hasCsvHeader(rows: string[][]): boolean {
  const first = rows[0]
  if (!first) return false
  if (first.some(cell => EMAIL_LIKE.test(cell.trim()))) return false
  return first.some(cell => fieldOf(cell) !== 'skip')
}

// With no header to go by: a column of addresses is Email, one of numbers Phone
function guessFromContent(rows: string[][], width: number): CsvField[] {
  return Array.from({ length: width }, (_, column): CsvField => {
    const cells = rows.map(row => row[column]?.trim() ?? '').filter(Boolean)
    if (!cells.length) return 'skip'
    const share = (pattern: RegExp) => cells.filter(cell => pattern.test(cell)).length / cells.length
    if (share(EMAIL_LIKE) > 0.5) return 'email'
    if (share(PHONE_LIKE) > 0.5) return 'phone'
    return 'skip'
  })
}

export interface CsvSheet {
  /** The column names, or “Column 1”… when the file has none */
  headers: string[]
  /** The people: every row but the header */
  rows: string[][]
  mapping: CsvField[]
  /** The columns were recognised well enough to skip the mapping step */
  recognised: boolean
}

/** A CSV file read and its columns guessed */
export function readCsv(text: string): CsvSheet {
  const all = parseCsv(text, detectDelimiter(text))
  const width = all.reduce((max, row) => Math.max(max, row.length), 0)
  const header = hasCsvHeader(all)
  const rows = header ? all.slice(1) : all
  const headers = Array.from({ length: width }, (_, index) => (header && all[0]![index]?.trim()) || `Column ${index + 1}`)
  const mapping = header ? guessCsvMapping(headers) : guessFromContent(rows, width)

  return {
    headers,
    rows,
    mapping,
    recognised: header && mapping.some(field => ['name', 'first', 'last'].includes(field))
  }
}

/** The rows as contacts, each column filed where the mapping says */
export function csvToContacts(rows: string[][], mapping: CsvField[]): ContactDraft[] {
  return rows.map((row) => {
    const cells = (field: CsvField) => mapping.flatMap((mapped, index) => mapped === field && row[index]?.trim() ? [row[index]!.trim()] : [])
    const one = (field: CsvField) => optional(cells(field)[0])

    // Google puts several values in one cell, parted by “ ::: ”
    const emails = unique(cells('email').flatMap(cell => cell.split(/\s*:::\s*|[;,\s]+/)).map(email => email.trim()))
    const phones = unique(cells('phone').flatMap(cell => cell.split(/\s*:::\s*/)).map(phone => phone.trim()))
    const company = one('company')

    return {
      name: one('name') || [one('first'), one('middle'), one('last')].filter(Boolean).join(' ') || company || emails[0] || '',
      emails,
      phones,
      company,
      title: one('title'),
      note: optional(cells('note').join('\n')),
      birthday: normaliseBirthday(one('birthday'))
    }
  })
}

// Excel opens a text cell starting with = + - or @ as a formula
function csvCell(value: string | undefined): string {
  const text = value ?? ''
  const safe = /^[=+\-@\t\r]/.test(text) && !PHONE_LIKE.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * The contacts as a CSV table with as many Email and Phone columns as the
 * fullest contact needs. Starts with a byte order mark so Excel reads the
 * accents right; `readCsv` recognises every column
 */
export function contactsToCsv(contacts: ContactDraft[]): string {
  const emails = Math.max(1, ...contacts.map(contact => contact.emails.length))
  const phones = Math.max(1, ...contacts.map(contact => contact.phones.length))
  const numbered = (label: string, count: number) => Array.from({ length: count }, (_, index) => index ? `${label} ${index + 1}` : label)

  const rows = [
    ['Name', ...numbered('Email', emails), ...numbered('Phone', phones), 'Company', 'Job title', 'Birthday', 'Notes'],
    ...contacts.map(contact => [
      contact.name,
      ...Array.from({ length: emails }, (_, index) => contact.emails[index]),
      ...Array.from({ length: phones }, (_, index) => contact.phones[index]),
      contact.company,
      contact.title,
      contact.birthday,
      contact.note
    ])
  ]

  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/* ------------------------------------------------------------------ */
/* Checking before anything is sent                                    */

export interface ContactProblem {
  field: keyof ContactDraft
  /** Which address or number, for the two lists */
  index?: number
  message: string
}

const FIELD_NAMES: Record<string, string> = {
  name: 'The name',
  company: 'The company',
  title: 'The job title',
  note: 'The note',
  birthday: 'The birthday'
}

/**
 * What the address book would refuse about a contact, in plain words. Asked
 * of the server's own rules, so the two cannot drift apart
 */
export function contactProblems(contact: ContactDraft): ContactProblem[] {
  const result = contactSchema.safeParse({ ...contact, id: '', bookId: 'book' })
  if (result.success) return []

  return result.error.issues.map((issue): ContactProblem => {
    const field = String(issue.path[0]) as keyof ContactDraft
    const index = typeof issue.path[1] === 'number' ? issue.path[1] : undefined
    const limit = 'maximum' in issue ? Number(issue.maximum) : undefined

    if (field === 'emails' && index !== undefined) return { field, index, message: `“${contact.emails[index]}” is not an email address` }
    if (field === 'phones' && index !== undefined) {
      return { field, index, message: issue.code === 'too_big' ? `A phone number is longer than ${limit} characters` : 'A phone number is empty' }
    }
    if (field === 'name' && issue.code !== 'too_big') return { field, message: 'A name is needed' }
    if (issue.code === 'too_big' && FIELD_NAMES[field]) return { field, message: `${FIELD_NAMES[field]} is longer than ${limit} characters` }
    return { field, index, message: issue.message }
  })
}

export interface ImportRow {
  contact: ContactDraft
  /** Why it cannot be added; empty when it can */
  problems: string[]
  /** It shares an address, a name or a number with someone already there, or earlier in the file */
  duplicate: boolean
}

/**
 * Every contact read from a file, checked and compared with the address
 * book. Blank cards are dropped: a row of nothing is not a person
 */
export function prepareImport(drafts: ContactDraft[], existing: Contact[]): ImportRow[] {
  const known = new Set(existing.flatMap(duplicateKeys))

  return drafts
    .map((draft): ContactDraft => ({
      name: draft.name.trim(),
      emails: unique(draft.emails.map(email => email.trim())),
      phones: unique(draft.phones.map(phone => phone.trim())),
      company: optional(draft.company),
      title: optional(draft.title),
      note: optional(draft.note),
      birthday: optional(draft.birthday)
    }))
    .filter(contact => contact.name || contact.emails.length || contact.phones.length)
    .map((contact) => {
      const keys = duplicateKeys(contact)
      const duplicate = keys.some(key => known.has(key))
      for (const key of keys) known.add(key)
      return { contact, problems: [...new Set(contactProblems(contact).map(problem => problem.message))], duplicate }
    })
}
