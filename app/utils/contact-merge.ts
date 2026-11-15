// Finding the same person filed more than once, and folding the copies into
// one. Pure functions, so the dialog only has to show what they return

export type DuplicateReason = 'email' | 'name' | 'phone'

export interface DuplicateGroup {
  /** Stable for a given set of contacts: their ids, joined */
  key: string
  /** What the contacts have in common, in the order email, name, phone */
  reasons: DuplicateReason[]
  /** The fullest contact first: it is the one that is kept */
  contacts: Contact[]
  /** What the first contact becomes once the others are folded into it */
  merged: Contact
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

// “Ruiz, Ana” and “Ana  Ruíz” are one person: case, accents, punctuation and
// the order of the words are all left out of the comparison
export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

// The last nine digits, so a number written with its country code meets the
// same one written without. Anything too short to be a phone number is left out
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '')
  if (digits.length < 5) return ''
  return digits.length > 9 ? digits.slice(-9) : digits
}

function keysOf(contact: Pick<Contact, 'name' | 'emails' | 'phones'>): { reason: DuplicateReason, value: string }[] {
  const name = normaliseName(contact.name)
  return [
    ...contact.emails.map(email => ({ reason: 'email' as const, value: normaliseEmail(email) })),
    { reason: 'name' as const, value: name },
    ...contact.phones.map(phone => ({ reason: 'phone' as const, value: normalisePhone(phone) }))
  ].filter(key => key.value)
}

/**
 * What a contact can be recognised by, as `reason:value` strings: two
 * contacts sharing one of them look like the same person. An import asks
 * this of people who are not in the address book yet
 */
export function duplicateKeys(contact: Pick<Contact, 'name' | 'emails' | 'phones'>): string[] {
  return keysOf(contact).map(key => `${key.reason}:${key.value}`)
}

// How much a contact says, to pick the one worth keeping
function weight(contact: Contact): number {
  return contact.emails.length + contact.phones.length
    + [contact.company, contact.title, contact.note, contact.birthday].filter(Boolean).length
}

function longest(values: (string | undefined)[]): string | undefined {
  return values.reduce<string | undefined>((best, value) => {
    const trimmed = value?.trim()
    return trimmed && trimmed.length > (best?.length ?? 0) ? trimmed : best
  }, undefined)
}

/**
 * One contact out of several: the first keeps its id and address book, and
 * takes every address and number the others have, the longest name, company,
 * job title and note, and the first birthday
 */
export function mergeContacts(contacts: Contact[]): Contact {
  const first = contacts[0]!

  const emails = new Map<string, string>()
  for (const email of contacts.flatMap(contact => contact.emails)) {
    const key = normaliseEmail(email)
    if (key && !emails.has(key)) emails.set(key, email.trim())
  }

  // The same number twice keeps its fullest spelling, the one with the country code
  const phones = new Map<string, string>()
  for (const phone of contacts.flatMap(contact => contact.phones)) {
    const key = normalisePhone(phone) || phone.trim()
    const kept = phones.get(key)
    if (key && (!kept || phone.replace(/\D/g, '').length > kept.replace(/\D/g, '').length)) phones.set(key, phone.trim())
  }

  return {
    id: first.id,
    bookId: first.bookId,
    name: longest(contacts.map(contact => contact.name)) ?? first.name,
    emails: [...emails.values()],
    phones: [...phones.values()],
    company: longest(contacts.map(contact => contact.company)),
    title: longest(contacts.map(contact => contact.title)),
    note: longest(contacts.map(contact => contact.note)),
    birthday: contacts.find(contact => contact.birthday?.trim())?.birthday
  }
}

/**
 * Contacts that share an email address, a name or a phone number, gathered
 * into groups. Sharing carries over: if A and B share an address and B and C
 * a number, all three are one group
 */
export function findDuplicateGroups(contacts: Contact[]): DuplicateGroup[] {
  const parent = contacts.map((_, index) => index)

  function find(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!
      index = parent[index]!
    }
    return index
  }

  const seen = new Map<string, number>()
  const shared = new Map<string, DuplicateReason>()

  contacts.forEach((contact, index) => {
    for (const { reason, value } of keysOf(contact)) {
      const key = `${reason}:${value}`
      const other = seen.get(key)
      if (other === undefined) {
        seen.set(key, index)
      } else if (other !== index) {
        parent[find(index)] = find(other)
        shared.set(key, reason)
      }
    }
  })

  const members = new Map<number, number[]>()
  contacts.forEach((_, index) => {
    const root = find(index)
    members.set(root, [...(members.get(root) ?? []), index])
  })

  const order: DuplicateReason[] = ['email', 'name', 'phone']

  return [...members.values()]
    .filter(indexes => indexes.length > 1)
    .map((indexes) => {
      // A stable sort, so equally full contacts stay in the order they came in
      const group = indexes.map(index => contacts[index]!).sort((a, b) => weight(b) - weight(a))
      const keys = new Set(group.flatMap(contact => keysOf(contact).map(key => `${key.reason}:${key.value}`)))
      const reasons = new Set([...shared.entries()].filter(([key]) => keys.has(key)).map(([, reason]) => reason))

      return {
        key: group.map(contact => contact.id).join('|'),
        reasons: order.filter(reason => reasons.has(reason)),
        contacts: group,
        merged: mergeContacts(group)
      }
    })
}
