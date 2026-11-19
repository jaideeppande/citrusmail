// Time zones for a contact: the list to pick from and the clock on their wall

/** Where most people a mailbox writes to live, west to east */
const COMMON = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Athens',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
]

export function contactLocalZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Every zone this computer knows, or the common ones on a system too old to say */
export function contactZoneList(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return COMMON
  }
}

/** Your own zone and the usual ones first, then the rest */
export function contactCommonZones(): string[] {
  const known = new Set(contactZoneList())
  return [...new Set([contactLocalZone(), 'UTC', ...COMMON])].filter(zone => zone === 'UTC' || known.has(zone))
}

/** `America/Argentina/Buenos_Aires` → “Buenos Aires, Argentina, America” */
export function contactZoneLabel(zone: string): string {
  return zone.split('/').reverse().join(', ').replace(/_/g, ' ')
}

/** Minutes east of UTC at that moment, or undefined for a zone this computer does not know */
export function contactZoneOffset(zone: string, at = new Date()): number | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at)
    const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
    const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
    return Math.round((wall - at.getTime()) / 60_000)
  } catch {
    return undefined
  }
}

/** “UTC+5:30” */
export function contactOffsetLabel(minutes: number): string {
  if (!minutes) return 'UTC'
  const size = Math.abs(minutes)
  const rest = size % 60
  return `UTC${minutes < 0 ? '−' : '+'}${Math.floor(size / 60)}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`
}

/** “Tue 14:05”: the day too, since it may not be yours */
export function contactZoneTime(zone: string, at = new Date()): string | undefined {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  } catch {
    return undefined
  }
}

/** “3 h ahead of you”, “5 h 30 min behind you”, “same time as you” */
export function contactZoneDifference(zone: string, at = new Date()): string | undefined {
  const theirs = contactZoneOffset(zone, at)
  const yours = contactZoneOffset(contactLocalZone(), at)
  if (theirs === undefined || yours === undefined) return undefined
  const difference = theirs - yours
  if (!difference) return 'same time as you'
  const size = Math.abs(difference)
  const text = [Math.floor(size / 60) ? `${Math.floor(size / 60)} h` : '', size % 60 ? `${size % 60} min` : ''].filter(Boolean).join(' ')
  return `${text} ${difference > 0 ? 'ahead of' : 'behind'} you`
}
