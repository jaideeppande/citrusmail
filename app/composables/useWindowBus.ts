// How the app's windows keep each other up to date. Reading, flagging or
// archiving a message in one window is said here, and every other window
// (pop-outs and the panes of a split layout included) changes its own list
// to match without asking the server again

export type BusEvent
  = | { type: 'mail:patch', folder: string, id: string, change: Partial<MessageSummary> }
    | { type: 'mail:gone', folder: string, id: string }
    /** Something changed that a patch can't describe: lists are fetched again */
    | { type: 'mail:refresh', folder?: string }
    | { type: 'settings:changed' }
    | { type: 'scheduled:changed' }
    | { type: 'contacts:changed' }
    | { type: 'events:changed' }
    /** A pop-out asks the main window to take over what it shows */
    | { type: 'window:dock', path: string }
    /** A pane asks the window it sits in to close it or pop it out */
    | { type: 'pane:close', index: number }
    | { type: 'pane:popout', index: number, path: string }
    | { type: 'pane:route', index: number, path: string }
    /** Another window wants a message written, e.g. from the app's menu */
    | { type: 'compose', to?: Address[] }

type Listener = (event: BusEvent) => void

let channel: BroadcastChannel | undefined
const listeners = new Set<Listener>()

function connect() {
  if (channel || !import.meta.client || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel('citrusmail')
  channel.onmessage = message => listeners.forEach(listener => listener(message.data as BusEvent))
}

/** Tells every other window; this one has already made the change itself */
export function tellWindows(event: BusEvent) {
  connect()
  channel?.postMessage(event)
}

/** Hears what other windows did, for as long as the caller's scope lives */
export function onWindowEvent(listener: Listener) {
  connect()
  listeners.add(listener)
  if (getCurrentScope()) onScopeDispose(() => listeners.delete(listener))
  return () => listeners.delete(listener)
}
