/** Settings → Appearance → Follow the time of day. Times are HH:mm, local */
interface ThemeSchedule {
  on: boolean
  light: string
  dark: string
  /** The theme chosen before the schedule took over, put back when it's turned off */
  before?: string
}

/** One card in the Appearance gallery: an accent, a font and corners that sit well together */
interface ThemePreset {
  id: string
  label: string
  /** A hex accent; absent for the instance's own */
  primary?: string
  /** A font stack from `citrusmail.fonts`; absent for the instance's own */
  font?: string
  radius?: string
}

/** Do not disturb: a time in ms it lasts until, 0 for off, -1 until turned off */
interface DndState {
  until: number
  /** Which choice set it, so Settings can show it as chosen */
  mode?: DndMode
}

type DndMode = 'hour' | 'morning' | 'on'

/** Settings → Privacy → App lock. The PIN itself is never kept, only a salted hash */
interface AppLockConfig {
  enabled: boolean
  salt: string
  hash: string
  /** How many digits the PIN has, so the lock screen can check it as the last one is typed */
  length: number
  /** Minutes without a key or pointer before the app locks itself; 0 for never */
  idle: number
  touchId: boolean
}

/** Shared by every window: locking one locks them all, and a reload stays locked */
interface AppLockState {
  locked: boolean
  /** Wrong PINs in a row */
  tries: number
  /** No more tries until this time (ms) */
  cooldown: number
}

/** One item in the What’s new panel */
interface ReleaseHighlight {
  icon: string
  title: string
  text: string
}

/** One coach mark of the first-run tour, pointing at `[data-tour="<target>"]` */
interface TourStep {
  target: string
  title: string
  text: string
}
