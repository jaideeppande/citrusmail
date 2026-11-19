import { describe, expect, it } from 'vitest'
import {
  contactProblems,
  contactsToCsv,
  contactsToVCard,
  csvToContacts,
  detectDelimiter,
  guessCsvMapping,
  normaliseBirthday,
  parseCsv,
  parseVCards,
  prepareImport,
  readCsv
} from '../app/utils/contact-import'
import type { ContactDraft } from '../app/utils/contact-import'

function draft(fields: Partial<ContactDraft> = {}): ContactDraft {
  return { name: 'Ana Ruiz', emails: [], phones: [], ...fields }
}

describe('parseVCards', () => {
  it('reads several cards with the fields the address book keeps', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Ana Ruiz',
      'N:Ruiz;Ana;;;',
      'EMAIL;TYPE=work:ana@example.com',
      'EMAIL;TYPE=home;PREF=1:ana.home@example.com',
      'TEL;TYPE=cell:+34 600 111 222',
      'ORG:Acme;Research',
      'TITLE:Engineer',
      'NOTE:Met at the conference',
      'BDAY:19900412',
      'END:VCARD',
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Okri;Ben;;Dr;',
      'EMAIL;TYPE=INTERNET:mailto:ben@example.com',
      'BDAY:--0704',
      'END:VCARD'
    ].join('\r\n')

    expect(parseVCards(text)).toEqual([{
      name: 'Ana Ruiz',
      emails: ['ana.home@example.com', 'ana@example.com'],
      phones: ['+34 600 111 222'],
      company: 'Acme',
      title: 'Engineer',
      note: 'Met at the conference',
      birthday: '1990-04-12'
    }, {
      name: 'Dr Ben Okri',
      emails: ['ben@example.com'],
      phones: [],
      company: undefined,
      title: undefined,
      note: undefined,
      birthday: '--07-04'
    }])
  })

  it('joins folded lines, with a space or a tab, and LF or CRLF endings', () => {
    const text = 'BEGIN:VCARD\nFN:Anastasia Maria\n  Ruiz-Gonzalez\nNOTE:one\r\n\ttwo\r\nEND:VCARD\n'
    const [card] = parseVCards(text)
    expect(card!.name).toBe('Anastasia Maria Ruiz-Gonzalez')
    expect(card!.note).toBe('onetwo')
  })

  it('unescapes commas, semicolons, backslashes and line breaks', () => {
    const [card] = parseVCards('BEGIN:VCARD\nFN:Ruiz\\, Ana\nORG:Smith\\; Sons;Sales\nNOTE:Line one\\nLine two \\\\ end\nEND:VCARD')
    expect(card!.name).toBe('Ruiz, Ana')
    expect(card!.company).toBe('Smith; Sons')
    expect(card!.note).toBe('Line one\nLine two \\ end')
  })

  it('decodes quoted-printable, soft line breaks included, in the stated charset', () => {
    const text = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=89mile Zola',
      'NOTE;ENCODING=QUOTED-PRINTABLE:Caf=C3=A9 au =',
      'lait',
      'TITLE;CHARSET=ISO-8859-1;QUOTED-PRINTABLE:Ma=EEtre',
      'END:VCARD'
    ].join('\r\n')
    const [card] = parseVCards(text)
    expect(card!.name).toBe('Émile Zola')
    expect(card!.note).toBe('Café au lait')
    expect(card!.title).toBe('Maître')
  })

  it('ignores group prefixes, pictures and a byte order mark, and keeps non-ASCII names', () => {
    const text = '\uFEFFBEGIN:VCARD\nFN:李小龍\nitem1.EMAIL;type=INTERNET:lee@example.com\nPHOTO;ENCODING=b;TYPE=JPEG:AAAA\nEND:VCARD'
    expect(parseVCards(text)).toEqual([expect.objectContaining({ name: '李小龍', emails: ['lee@example.com'] })])
  })

  it('names a card with no name after its company or address', () => {
    const [card] = parseVCards('BEGIN:VCARD\nEMAIL:info@acme.test\nEND:VCARD')
    expect(card!.name).toBe('info@acme.test')
  })

  it('reads its own output back', () => {
    const contacts = [
      draft({ name: 'Ruiz, Ana; “the boss”', emails: ['ana@example.com', 'a@example.org'], phones: ['+34 600'], company: 'Acme, Inc.', title: 'CTO', birthday: '1990-04-12', note: 'Two\nlines and a very long note that goes on well past the seventy-five byte limit of a vCard line with ünïcödé' })
    ]
    const text = contactsToVCard(contacts)
    expect(text.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(parseVCards(text)).toEqual(contacts.map(contact => ({ ...contact })))
  })
})

describe('CSV', () => {
  it('reads quoted fields with delimiters, doubled quotes and line breaks', () => {
    expect(parseCsv('name,note\r\n"Ruiz, Ana","She said ""hi""\nthen left"\r\n')).toEqual([
      ['name', 'note'],
      ['Ruiz, Ana', 'She said "hi"\nthen left']
    ])
  })

  it('drops empty rows and a byte order mark', () => {
    expect(parseCsv('\uFEFFa,b\n\n,\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('detects the delimiter', () => {
    expect(detectDelimiter('Name;Email\nAna;ana@example.com\nBen;ben@example.com')).toBe(';')
    expect(detectDelimiter('Name\tEmail\nAna\tana@example.com')).toBe('\t')
    expect(detectDelimiter('Name,Email\n"Ruiz; Ana",ana@example.com')).toBe(',')
  })

  it('recognises Google Contacts columns', () => {
    const text = 'First Name,Middle Name,Last Name,Birthday,Notes,Organization Name,Organization Title,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value\n'
      + 'Ana,,Ruiz,1990-04-12,Friend,Acme,CTO,* Home,ana@example.com ::: ana@work.test,Mobile,+34 600 111 222\n'
    const sheet = readCsv(text)
    expect(sheet.recognised).toBe(true)
    expect(csvToContacts(sheet.rows, sheet.mapping)).toEqual([{
      name: 'Ana Ruiz',
      emails: ['ana@example.com', 'ana@work.test'],
      phones: ['+34 600 111 222'],
      company: 'Acme',
      title: 'CTO',
      note: 'Friend',
      birthday: '1990-04-12'
    }])
  })

  it('recognises Outlook columns', () => {
    expect(guessCsvMapping(['Title', 'First Name', 'Last Name', 'Company', 'Job Title', 'E-mail Address', 'E-mail Display Name', 'Mobile Phone', 'Business Fax', 'Birthday', 'Notes']))
      .toEqual(['skip', 'first', 'last', 'company', 'title', 'email', 'skip', 'phone', 'skip', 'birthday', 'note'])
  })

  it('guesses columns from their content when there is no header', () => {
    const sheet = readCsv('Ana Ruiz,ana@example.com,+34 600 111 222\nBen Okri,ben@example.com,+44 20 7946 0000\n')
    expect(sheet.recognised).toBe(false)
    expect(sheet.headers).toEqual(['Column 1', 'Column 2', 'Column 3'])
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.mapping).toEqual(['skip', 'email', 'phone'])
  })

  it('reads its own output back, accents and all', () => {
    const contacts = [
      draft({ name: 'Émile “Zed”, Jr.', emails: ['e@example.com', 'z@example.com'], phones: ['+33 1 23'], note: 'Line\nbreak', birthday: '--07-04' }),
      draft({ name: 'Ben', emails: ['ben@example.com'], company: 'Okri & Co' })
    ]
    const csv = contactsToCsv(contacts)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const sheet = readCsv(csv)
    expect(sheet.recognised).toBe(true)
    expect(csvToContacts(sheet.rows, sheet.mapping)).toEqual(contacts.map(contact => ({
      name: contact.name,
      emails: contact.emails,
      phones: contact.phones,
      company: contact.company,
      title: undefined,
      note: contact.note,
      birthday: contact.birthday
    })))
  })

  it('keeps a spreadsheet from running a cell as a formula', () => {
    expect(contactsToCsv([draft({ name: '=HYPERLINK("x")' })])).toContain('"\'=HYPERLINK(""x"")"')
  })
})

describe('birthdays', () => {
  it('reads the common spellings', () => {
    expect(normaliseBirthday('1990-04-12')).toBe('1990-04-12')
    expect(normaliseBirthday('19900412T000000')).toBe('1990-04-12')
    expect(normaliseBirthday('--0412')).toBe('--04-12')
    expect(normaliseBirthday('12.04.1990')).toBe('1990-04-12')
    expect(normaliseBirthday('4/12/1990')).toBe('1990-04-12')
    expect(normaliseBirthday('25/12/1990')).toBe('1990-12-25')
    expect(normaliseBirthday('next Tuesday')).toBeUndefined()
    expect(normaliseBirthday('1990-13-01')).toBeUndefined()
  })
})

describe('checking before import', () => {
  it('reports what the server would refuse, in plain words', () => {
    expect(contactProblems(draft({ emails: ['ana@example.com'] }))).toEqual([])
    expect(contactProblems(draft({ name: ' ' })).map(problem => problem.message)).toEqual(['A name is needed'])
    expect(contactProblems(draft({ emails: ['not an address'] })).map(problem => problem.message)).toEqual(['“not an address” is not an email address'])
    expect(contactProblems(draft({ note: 'x'.repeat(5001) })).map(problem => problem.message)).toEqual(['The note is longer than 5000 characters'])
  })

  it('marks duplicates of the address book and of earlier rows, and drops blank ones', () => {
    const existing: Contact[] = [{ id: '1', bookId: 'b', name: 'Ana Ruiz', emails: ['ana@example.com'], phones: [] }]
    const rows = prepareImport([
      draft({ name: 'A. Ruiz', emails: ['ANA@example.com'] }),
      draft({ name: 'Ben Okri', emails: ['ben@example.com'] }),
      draft({ name: 'Benjamin', emails: ['ben@example.com'] }),
      draft({ name: '', emails: [], phones: [] }),
      draft({ name: 'Cara', emails: ['bad'] })
    ], existing)
    expect(rows.map(row => [row.contact.name, row.duplicate, row.problems.length])).toEqual([
      ['A. Ruiz', true, 0],
      ['Ben Okri', false, 0],
      ['Benjamin', true, 0],
      ['Cara', false, 1]
    ])
  })
})
