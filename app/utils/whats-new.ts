// What the What’s new panel says after an update. Rewritten for each
// release: a handful of things worth knowing, most useful first

export const RELEASE_HIGHLIGHTS: ReleaseHighlight[] = [
  { icon: 'i-lucide-layout-panel-left', title: 'Windows and split layouts', text: 'Open a message, the composer or your calendar in its own window, or put two or three side by side.' },
  { icon: 'i-lucide-command', title: 'Search and commands', text: 'One box that goes anywhere and does anything. Type a few letters of what you want.' },
  { icon: 'i-lucide-messages-square', title: 'Conversations', text: 'Replies are grouped under one row and stacked as you read. Turn it off in Settings → Reading.' },
  { icon: 'i-lucide-undo-2', title: 'Undo, snooze and pins', text: 'Take back a send or a delete, hide a message until later, and keep the ones that matter at the top.' },
  { icon: 'i-lucide-inbox', title: 'Triage mode and the Today panel', text: 'Clear your Inbox one message at a time, with today’s meetings and reminders beside it.' },
  { icon: 'i-lucide-keyboard', title: 'Shortcuts you can change', text: 'Several drafts open at once, and every key yours to set, with presets for Gmail, Outlook and Superhuman.' }
]

/** The first-run tour: each step points at the control marked `data-tour="<target>"` */
export const TOUR_STEPS: TourStep[] = [
  { target: 'palette', title: 'Find anything, do anything', text: 'Search your mail or type a command: “new message”, “dark”, a folder’s name.' },
  { target: 'list', title: 'Your mail', text: 'Conversations are grouped. Hover a row to archive, snooze or pin it, or use the keys.' },
  { target: 'layout', title: 'Choose a layout', text: 'Read with the list beside the message, on its own, or split the window in two or three.' },
  { target: 'popout', title: 'Give it its own window', text: 'A message, a draft or the calendar can sit in a separate window, on another screen if you like.' },
  { target: 'today', title: 'Today at a glance', text: 'Meetings, snoozed mail coming back and follow-ups due, without leaving your Inbox.' }
]
