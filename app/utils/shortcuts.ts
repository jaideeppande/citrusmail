// Every keyboard shortcut the app has, by name. The keys here are the
// defaults; Settings → Shortcuts swaps in a preset or your own. A key is
// written the way `defineShortcuts` takes it: `meta_k` for a chord (meta is
// Ctrl on Windows), `g-i` for one key after another

export interface ShortcutDef {
  label: string
  group: 'Mail' | 'Compose' | 'Go to' | 'Windows' | 'Calendar' | 'App'
  keys: string[]
}

export const SHORTCUTS = {
  'mail.compose': { label: 'New message', group: 'Mail', keys: ['c'] },
  'mail.next': { label: 'Next message', group: 'Mail', keys: ['j', 'arrowdown'] },
  'mail.prev': { label: 'Previous message', group: 'Mail', keys: ['k', 'arrowup'] },
  'mail.reply': { label: 'Reply', group: 'Mail', keys: ['r'] },
  'mail.replyAll': { label: 'Reply all', group: 'Mail', keys: ['a'] },
  'mail.forward': { label: 'Forward', group: 'Mail', keys: ['f'] },
  'mail.quickReply': { label: 'Quick reply', group: 'Mail', keys: ['shift_r'] },
  'mail.archive': { label: 'Archive', group: 'Mail', keys: ['e'] },
  'mail.delete': { label: 'Delete', group: 'Mail', keys: ['#', 'delete', 'backspace'] },
  'mail.flag': { label: 'Flag', group: 'Mail', keys: ['s'] },
  'mail.toggleRead': { label: 'Mark read / unread', group: 'Mail', keys: ['shift_u'] },
  'mail.snooze': { label: 'Snooze', group: 'Mail', keys: ['h'] },
  'mail.pin': { label: 'Pin to top', group: 'Mail', keys: ['p'] },
  'mail.select': { label: 'Select message', group: 'Mail', keys: ['x'] },
  'mail.selectAll': { label: 'Select all', group: 'Mail', keys: ['shift_a'] },
  'mail.undo': { label: 'Undo', group: 'Mail', keys: ['z'] },
  'mail.triage': { label: 'Triage mode', group: 'Mail', keys: ['shift_t'] },
  'mail.toggleView': { label: 'Split or list view', group: 'Mail', keys: ['shift_v'] },
  'mail.search': { label: 'Search', group: 'Mail', keys: ['/'] },
  'mail.print': { label: 'Print', group: 'Mail', keys: ['meta_p'] },
  'mail.label': { label: 'Label', group: 'Mail', keys: ['l'] },
  'mail.searchAll': { label: 'Search every folder', group: 'Mail', keys: ['meta_shift_f'] },
  'compose.send': { label: 'Send', group: 'Compose', keys: ['meta_enter'] },
  'compose.zen': { label: 'Distraction-free writing', group: 'Compose', keys: ['meta_shift_d'] },
  'compose.emoji': { label: 'Emoji', group: 'Compose', keys: ['meta_shift_e'] },
  'go.inbox': { label: 'Inbox', group: 'Go to', keys: ['g-i'] },
  'go.drafts': { label: 'Drafts', group: 'Go to', keys: ['g-d'] },
  'go.sent': { label: 'Sent', group: 'Go to', keys: ['g-t'] },
  'go.calendar': { label: 'Calendar', group: 'Go to', keys: ['g-c'] },
  'go.contacts': { label: 'Contacts', group: 'Go to', keys: ['g-p'] },
  'go.settings': { label: 'Settings', group: 'Go to', keys: ['g-s'] },
  'go.later': { label: 'Later board', group: 'Go to', keys: ['g-l'] },
  'window.popout': { label: 'Open in a new window', group: 'Windows', keys: ['shift_o'] },
  'window.layout': { label: 'Choose a layout', group: 'Windows', keys: ['shift_l'] },
  'window.focus': { label: 'Focus mode', group: 'Windows', keys: ['shift_f'] },
  'window.today': { label: 'Today panel', group: 'Windows', keys: ['shift_d'] },
  'calendar.day': { label: 'Day view', group: 'Calendar', keys: ['d'] },
  'calendar.week': { label: 'Week view', group: 'Calendar', keys: ['w'] },
  'calendar.month': { label: 'Month view', group: 'Calendar', keys: ['m'] },
  'calendar.year': { label: 'Year view', group: 'Calendar', keys: ['y'] },
  'calendar.today': { label: 'Today', group: 'Calendar', keys: ['t'] },
  'calendar.prev': { label: 'Previous', group: 'Calendar', keys: ['arrowleft'] },
  'calendar.next': { label: 'Next', group: 'Calendar', keys: ['arrowright'] },
  'calendar.newEvent': { label: 'New event', group: 'Calendar', keys: ['n'] },
  'calendar.agenda': { label: 'Agenda view', group: 'Calendar', keys: ['a'] },
  'app.palette': { label: 'Search and commands', group: 'App', keys: ['meta_k'] },
  'app.notifications': { label: 'Notifications', group: 'App', keys: ['shift_n'] },
  'app.assistant': { label: 'Ask AI', group: 'App', keys: ['meta_j'] },
  'app.sidebar': { label: 'Fold sidebar', group: 'App', keys: ['['] },
  'app.help': { label: 'These shortcuts', group: 'App', keys: ['?'] }
} as const satisfies Record<string, ShortcutDef>

export type ShortcutId = keyof typeof SHORTCUTS

export type ShortcutPreset = 'citrusmail' | 'gmail' | 'outlook' | 'superhuman'

/** What each preset changes from the defaults; anything it leaves out stays */
export const SHORTCUT_PRESETS: Record<ShortcutPreset, { label: string, description: string, keys: Partial<Record<ShortcutId, string[]>> }> = {
  citrusmail: { label: 'CitrusMail', description: 'The keys the app ships with.', keys: {} },
  gmail: {
    label: 'Gmail',
    description: 'For hands that learned Gmail’s keys.',
    keys: {
      'mail.toggleRead': ['shift_u', 'shift_i'],
      'mail.snooze': ['b'],
      'mail.selectAll': ['*-a'],
      'go.sent': ['g-t'],
      'go.contacts': ['g-c'],
      'go.calendar': ['g-k'],
      'go.later': ['g-l']
    }
  },
  outlook: {
    label: 'Outlook',
    description: 'Ctrl and a letter, as in Outlook.',
    keys: {
      'mail.compose': ['meta_n'],
      'mail.reply': ['meta_r'],
      'mail.replyAll': ['meta_shift_r'],
      'mail.forward': ['meta_f'],
      'mail.quickReply': ['alt_r'],
      'mail.archive': ['backspace'],
      'mail.delete': ['delete', 'meta_d'],
      'mail.flag': ['insert'],
      'mail.toggleRead': ['meta_u', 'meta_q'],
      'mail.search': ['meta_e', '/'],
      'mail.selectAll': ['meta_a'],
      'mail.undo': ['meta_z'],
      'go.inbox': ['meta_shift_i']
    }
  },
  superhuman: {
    label: 'Superhuman',
    description: 'Single keys built for clearing an inbox fast.',
    keys: {
      'mail.reply': ['r'],
      'mail.replyAll': ['shift_r', 'a'],
      'mail.quickReply': ['meta_shift_r'],
      'mail.toggleRead': ['u'],
      'mail.flag': ['s'],
      'mail.snooze': ['h'],
      'mail.triage': ['shift_t'],
      'mail.selectAll': ['meta_a'],
      'go.sent': ['g-t'],
      'go.drafts': ['g-d']
    }
  }
}

/** `shift_u` as the keys to draw: ['shift', 'u']; `g-i` as ['g', 'i'] */
export function shortcutParts(key: string): string[] {
  if (key === '-' || key === '_') return [key]
  return key.split(/[_-]/).filter(Boolean)
}

/** A key press as `defineShortcuts` would name it, for recording a new binding */
export function keyFromEvent(event: KeyboardEvent): string | undefined {
  const name = event.key.toLowerCase()
  if (['shift', 'control', 'alt', 'meta', 'dead', 'process'].includes(name)) return undefined
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('meta')
  if (event.altKey) parts.push('alt')
  // Shift is already in the character for symbols (? is not shift_/)
  if (event.shiftKey && (name.length > 1 || /[a-z0-9]/.test(name))) parts.push('shift')
  parts.push(name === ' ' ? 'space' : name)
  return parts.join('_')
}
