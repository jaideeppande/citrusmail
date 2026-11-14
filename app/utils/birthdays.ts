import { format } from 'date-fns'

// Birthdays as an address book stores them: a full date (1990-04-12), or one
// with no year, which vCard writes --04-12 or --0412. Apple's contacts stand a
// year of 1604 in for "not given"

export interface BirthdayParts {
  month: number
  day: number
  /** Absent when the card does not say */
  year?: number
}

export interface UpcomingBirthday {
  contact: Contact
  /** The day it next falls on, at local midnight */
  date: Date
  /** 0 is today */
  inDays: number
  /** The age they reach that day, when the year is known */
  turns?: number
}

const DAY = 24 * 60 * 60 * 1000

export function parseBirthday(value: string | undefined): BirthdayParts | null {
  const text = value?.trim()
  if (!text) return null

  const match = text.match(/^(\d{4})-?(\d{2})-?(\d{2})/) ?? text.match(/^(--)-?(\d{2})-?(\d{2})/)
  if (!match) return null

  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const year = match[1] === '--' ? undefined : Number(match[1])

  return { month, day, year: year && year > 1604 ? year : undefined }
}

// Someone born on 29 February is celebrated on the 28th in a year without one
function occurrence(parts: BirthdayParts, year: number): Date {
  const date = new Date(year, parts.month - 1, parts.day)
  return date.getMonth() === parts.month - 1 ? date : new Date(year, parts.month, 0)
}

/** The birthdays that fall within the next `days` days, soonest first */
export function upcomingBirthdays(contacts: Contact[], today: Date, days = 30): UpcomingBirthday[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return contacts
    .flatMap((contact): UpcomingBirthday[] => {
      const parts = parseBirthday(contact.birthday)
      if (!parts) return []

      let date = occurrence(parts, start.getFullYear())
      if (date < start) date = occurrence(parts, start.getFullYear() + 1)

      // Rounded, so a day an hour short of 24 across a clock change still counts as one
      const inDays = Math.round((date.getTime() - start.getTime()) / DAY)
      if (inDays > days) return []

      const turns = parts.year ? date.getFullYear() - parts.year : undefined

      return [{ contact, date, inDays, turns: turns && turns > 0 ? turns : undefined }]
    })
    .sort((a, b) => a.inDays - b.inDays || a.contact.name.localeCompare(b.contact.name, undefined, { sensitivity: 'base' }))
}

/** “today”, “tomorrow”, “in 12 days”, and “turns 34” after it when the year is known */
export function birthdayLabel(birthday: Pick<UpcomingBirthday, 'inDays' | 'turns'>): string {
  const when = birthday.inDays === 0 ? 'today' : birthday.inDays === 1 ? 'tomorrow' : `in ${birthday.inDays} days`
  return birthday.turns ? `${when} · turns ${birthday.turns}` : when
}

/** “12 April 1990”, or “12 April” when the card gives no year; the text as written when it is no date */
export function formatBirthday(value: string | undefined): string | undefined {
  if (!value) return undefined

  const parts = parseBirthday(value)
  if (!parts) return value

  // A leap year when there is none to go by, so 29 February stays itself
  const date = new Date(parts.year ?? 2000, parts.month - 1, parts.day)

  return format(date, parts.year ? 'd MMMM yyyy' : 'd MMMM')
}
