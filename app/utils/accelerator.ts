// The shortcut that opens a new message from any app is registered with the
// operating system by the desktop app, which names keys its own way
// ('CommandOrControl+Shift+M'), not the way shortcuts inside the app are named

const NAMED: Record<string, string> = {
  ' ': 'Space',
  'enter': 'Return',
  'tab': 'Tab',
  'backspace': 'Backspace',
  'delete': 'Delete',
  'insert': 'Insert',
  'home': 'Home',
  'end': 'End',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'arrowup': 'Up',
  'arrowdown': 'Down',
  'arrowleft': 'Left',
  'arrowright': 'Right'
}

type Press = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

/**
 * A key press as an Electron accelerator, or undefined while only modifiers
 * are down or the combination can't be a system-wide shortcut: it needs Ctrl,
 * Command or Alt, or a function key, so typing a letter never triggers it
 */
export function acceleratorFromEvent(event: Press): string | undefined {
  // The physical key, so Shift+2 is 2 rather than @ and Alt+M is M rather than µ
  const code = event.code
  const key = /^Key[A-Z]$/.test(code)
    ? code.slice(3)
    : /^Digit\d$/.test(code)
      ? code.slice(5)
      : /^F\d{1,2}$/.test(event.key)
        ? event.key
        : NAMED[event.key.toLowerCase()]
  if (!key) return undefined
  const strong = event.ctrlKey || event.metaKey || event.altKey
  if (!strong && !/^F\d{1,2}$/.test(key)) return undefined
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  return [...parts, key].join('+')
}

/** 'CommandOrControl+Shift+M' as the keys to draw with <UKbd>: ['meta', 'shift', 'M'] */
export function acceleratorParts(accelerator: string): string[] {
  const names: Record<string, string> = { CommandOrControl: 'meta', Alt: 'alt', Shift: 'shift', Return: 'enter', Up: 'arrowup', Down: 'arrowdown', Left: 'arrowleft', Right: 'arrowright' }
  return accelerator.split('+').filter(Boolean).map(part => names[part] ?? part)
}
