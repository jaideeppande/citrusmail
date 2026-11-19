export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: true,
  banners: true,
  inApp: true,
  sound: 'chime',
  volume: 60,
  preview: true,
  push: false,
  folders: {},
  muted: [],
  quietFrom: '',
  quietTo: ''
}

export const SOUNDS: { label: string, value: NotificationSound }[] = [
  { label: 'Chime', value: 'chime' },
  { label: 'Pop', value: 'pop' },
  { label: 'Bell', value: 'bell' },
  { label: 'Drop', value: 'drop' },
  { label: 'Marimba', value: 'marimba' },
  { label: 'No sound', value: 'none' }
]

/** Whether now falls between quiet-from and quiet-to, across midnight too */
export function inQuietHours(settings: NotificationSettings, now = new Date()) {
  if (!settings.quietFrom || !settings.quietTo || settings.quietFrom === settings.quietTo) return false
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const current = now.getHours() * 60 + now.getMinutes()
  const from = minutes(settings.quietFrom)
  const to = minutes(settings.quietTo)
  return from < to ? current >= from && current < to : current >= from || current < to
}

/** Whether do not disturb is on: `until` is a time in ms, 0 for off, -1 until it's turned off */
export function dndActive(until: number, now = Date.now()) {
  return until === -1 || until > now
}

/** When “until tomorrow morning” ends: 8:00 the next day, or today when it's still the small hours */
export function dndMorning(now = new Date()) {
  const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getHours() < 5 ? 0 : 1), 8, 0, 0, 0)
  return morning.getTime()
}

/** An entry is an address, or a domain written as @example.com or example.com */
export function isVip(address: string, vips: string[]) {
  const sender = address.trim().toLowerCase()
  return vips.some((entry) => {
    const vip = entry.trim().toLowerCase()
    if (!vip) return false
    if (vip.includes('@') && !vip.startsWith('@')) return sender === vip
    const domain = vip.replace(/^@/, '')
    return sender.endsWith(`@${domain}`) || sender.endsWith(`.${domain}`)
  })
}

/**
 * Whether a new message may ring. Quiet hours and do not disturb hold
 * everything back except mail from a VIP; notifications turned off hold
 * back all of it
 */
export function shouldNotify(sender: string, state: { enabled: boolean, quiet: boolean, dnd: boolean, vips: string[] }) {
  if (!state.enabled) return false
  if (!state.quiet && !state.dnd) return true
  return isVip(sender, state.vips)
}

// Each sound is a few notes made on the spot, so there are no files to ship
type Note = [frequency: number, start: number, length: number, type?: OscillatorType, endFrequency?: number]
const NOTES: Record<Exclude<NotificationSound, 'none'>, Note[]> = {
  chime: [[1318.5, 0, 0.5], [987.8, 0.12, 0.7]],
  pop: [[900, 0, 0.09, 'sine', 380]],
  bell: [[880, 0, 1.4], [1760, 0, 0.6], [2640, 0, 0.3]],
  drop: [[1400, 0, 0.18, 'sine', 420], [700, 0.14, 0.25, 'sine', 520]],
  marimba: [[1046.5, 0, 0.3, 'triangle'], [1318.5, 0.09, 0.3, 'triangle'], [1568, 0.18, 0.45, 'triangle']]
}

let context: AudioContext | undefined

export function playSound(sound: NotificationSound, volume: number) {
  if (sound === 'none' || volume <= 0 || typeof AudioContext === 'undefined') return
  context ??= new AudioContext()
  const ctx = context
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime + 0.02
  const peak = 0.25 * (volume / 100) ** 1.6

  for (const [frequency, start, length, type = 'sine', end] of NOTES[sound]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, now + start)
    if (end) osc.frequency.exponentialRampToValueAtTime(end, now + start + length)
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(peak, now + start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + length + 0.05)
  }
}
