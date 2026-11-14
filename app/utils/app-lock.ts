// App lock keeps a PIN the only way a PIN should be kept: not at all. What's
// stored is SHA-256 of a random salt and the PIN, which can be checked but
// not read back. It hides the app from someone at your desk; mail the app has
// already downloaded is not encrypted by it

export const APP_LOCK_IDLE = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: 'Only when I lock it', value: 0 }
]

export const DEFAULT_APP_LOCK: AppLockConfig = { enabled: false, salt: '', hash: '', length: 0, idle: 5, touchId: false }
export const DEFAULT_APP_LOCK_STATE: AppLockState = { locked: false, tries: 0, cooldown: 0 }

/** Wrong PINs in a row before a pause, and how long the pause is */
export const APP_LOCK_TRIES = 5
export const APP_LOCK_COOLDOWN = 30_000

export const isPin = (value: string) => /^\d{4,8}$/.test(value)

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return hex(new Uint8Array(digest))
}
