export type MotionLevel = 'system' | 'full' | 'reduced' | 'off'
export type Density = 'comfortable' | 'cozy' | 'compact'

/** How the app behaves on this computer (Settings → Appearance, Reading and Desktop) */
export interface Prefs {
  /** 'system' follows the computer's own Reduce motion setting */
  motion: MotionLevel
  density: Density
  /** Replies grouped under one row in the list and stacked in the reader */
  threading: boolean
  /** People, Newsletters, Notifications and Tracked as tabs over the Inbox */
  splitInbox: boolean
  /** Mail from someone new waits in Screen until you allow or block them */
  screening: boolean
  /** Seconds a sent message can still be taken back; 0 sends at once */
  undoSend: number
  /** Days before a sent message with no answer is marked for a follow-up; 0 for never */
  nudgeDays: number
  /** Closing the last window keeps the app in the tray (Windows) */
  closeToTray: boolean
  /** The shortcut that opens a new message from any app; empty for none */
  quickCompose: string
  /** Quiet cues for sending, archiving, snoozing and undoing */
  uiSounds: boolean
  /** 'high' draws stronger borders and text, for eyes or screens that need it */
  contrast: 'normal' | 'high'
  /** Bigger text and bigger things to click */
  largeText: boolean
}

export const DEFAULT_PREFS: Prefs = {
  motion: 'system',
  density: 'comfortable',
  threading: true,
  splitInbox: false,
  screening: false,
  undoSend: 10,
  nudgeDays: 3,
  closeToTray: false,
  quickCompose: '',
  uiSounds: false,
  contrast: 'normal',
  largeText: false
}

/** The handful of choices most of the app reads */
export function usePrefs() {
  return useLocalPref<Prefs>('prefs', DEFAULT_PREFS)
}

/** Row heights the virtual list is told to expect, per density */
export const DENSITY_ROWS: Record<Density, { roomy: number, compact: number }> = {
  comfortable: { roomy: 76, compact: 38 },
  cozy: { roomy: 66, compact: 34 },
  compact: { roomy: 56, compact: 30 }
}
