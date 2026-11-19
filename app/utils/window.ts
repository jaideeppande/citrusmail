// Which kind of window this is. The app opens in three shapes: the main
// window, a pop-out (one message, the composer, the calendar or contacts on
// their own, for another monitor) and a pane (one cell of a split layout).
// The kind rides on `window.name`, which a reload keeps and a link can't lose

export type WindowKind = 'main' | 'popout' | 'pane'

const POPOUT = 'citrus-popout'
const PANE = 'citrus-pane'

let kind: WindowKind | undefined

export function windowKind(): WindowKind {
  if (kind) return kind
  if (!import.meta.client) return 'main'
  // A window the desktop app restores at launch says what it is in its URL
  const asked = new URLSearchParams(location.search).get('win')
  if (asked === 'popout' && !window.name.startsWith(POPOUT)) window.name = `${POPOUT}-${Date.now().toString(36)}`
  kind = window.name.startsWith(PANE) ? 'pane' : window.name.startsWith(POPOUT) ? 'popout' : 'main'
  return kind
}

/** A pane's place in the layout, from its frame name (citrus-pane-2 is 2) */
export function paneIndex(): number {
  return import.meta.client ? Number(window.name.slice(PANE.length + 1)) || 0 : 0
}

export const paneName = (index: number) => `${PANE}-${index}`
export const popoutName = () => `${POPOUT}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * What the desktop app's preload exposes. A pane is a frame, which gets no
 * preload of its own, so it borrows the one of the window it sits in
 */
export function desktop(): CitrusDesktop | undefined {
  if (!import.meta.client) return undefined
  if (window.citrusDesktop) return window.citrusDesktop
  try {
    return window.top?.citrusDesktop
  } catch {
    return undefined
  }
}

/** Ctrl on Windows and Linux, Command on a Mac */
export function isMac() {
  return import.meta.client && (desktop()?.platform === 'darwin' || /Mac|iPhone|iPad/.test(navigator.platform))
}
