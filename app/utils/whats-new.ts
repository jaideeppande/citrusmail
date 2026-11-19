// What the What’s new panel says after an update. Rewritten for each
// release: a handful of things worth knowing, most useful first

/**
 * Names this set of highlights. The panel opens once for each new one, so
 * change it whenever the list below is rewritten, even when the app's
 * version number stays the same
 */
export const RELEASE_ID = '2026-11-labels-themes'

export const RELEASE_HIGHLIGHTS: ReleaseHighlight[] = [
  { icon: 'i-lucide-tag', title: 'Labels and the Later board', text: 'Tag a message with as many labels as you like, and line up what can wait on a board of its own.' },
  { icon: 'i-lucide-search', title: 'Search every folder', text: 'One search across all your folders at once, not only the one that’s open.' },
  { icon: 'i-lucide-bell', title: 'A notification centre', text: 'What came in while you were away, in one place, for every mailbox.' },
  { icon: 'i-lucide-pen-line', title: 'Writing mode', text: 'The composer fills the window and everything else steps back. Tables, pictures and code blocks now go in messages too.' },
  { icon: 'i-lucide-calendar-range', title: 'Agenda and a second time zone', text: 'Your calendar as a list of what’s coming, with the hours of another city beside your own.' },
  { icon: 'i-lucide-users', title: 'Contact groups, import and export', text: 'Write to a group by its name, and bring contacts in or take them out as vCard or CSV.' },
  { icon: 'i-lucide-swatch-book', title: 'A theme editor and higher contrast', text: 'Change every color with a live preview, or turn on Increase contrast and larger controls in Settings → Accessibility.' }
]

/** The first-run tour: each step points at the control marked `data-tour="<target>"` */
export const TOUR_STEPS: TourStep[] = [
  { target: 'palette', title: 'Find anything, do anything', text: 'Search your mail or type a command: “new message”, “dark”, a folder’s name.' },
  { target: 'list', title: 'Your mail', text: 'Conversations are grouped. Hover a row to archive, snooze or pin it, or use the keys.' },
  { target: 'layout', title: 'Choose a layout', text: 'Read with the list beside the message, on its own, or split the window in two or three.' },
  { target: 'popout', title: 'Give it its own window', text: 'A message, a draft or the calendar can sit in a separate window, on another screen if you like.' },
  { target: 'today', title: 'Today at a glance', text: 'Meetings, snoozed mail coming back and follow-ups due, without leaving your Inbox.' }
]
