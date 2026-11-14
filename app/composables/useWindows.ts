// More than one window. A pop-out shows one thing on its own (a message, the
// composer, the calendar, contacts) so it can sit on another monitor; in the
// desktop app the main process opens it and remembers where it was put. In a
// browser it's an ordinary popup window

const POPOUT_SIZES: [pattern: RegExp, width: number, height: number][] = [
  [/^\/compose/, 760, 760],
  [/^\/mail\/[^?]+\?.*\bm=/, 900, 860],
  [/^\/contacts/, 1040, 760]
]

function sizeFor(path: string) {
  const match = POPOUT_SIZES.find(([pattern]) => pattern.test(path))
  return match ? { width: match[1], height: match[2] } : { width: 1180, height: 820 }
}

/** Opens a page of the app in a window of its own */
export function openPopout(path: string) {
  const size = sizeFor(path)
  const app = desktop()
  if (app) {
    app.openWindow(path, { kind: 'popout', ...size }).catch(() => {})
    return
  }
  const url = new URL(path, location.origin)
  url.searchParams.set('win', 'popout')
  const left = Math.round(window.screenX + (window.outerWidth - size.width) / 2)
  const top = Math.round(window.screenY + (window.outerHeight - size.height) / 2)
  window.open(url, popoutName(), `popup,width=${size.width},height=${size.height},left=${left},top=${top}`)
}

/** Closes this window, when it is one the app opened */
export function closeWindow() {
  const app = desktop()
  if (app) app.closeWindow()
  else window.close()
}

/**
 * Hands what a pop-out shows back to the main window and closes the pop-out.
 * The main window hears it on the bus; in the desktop app it also comes forward
 */
export function dockBack(path: string) {
  tellWindows({ type: 'window:dock', path })
  desktop()?.focusMain().catch(() => {})
  closeWindow()
}

/** The page on screen without the bits that only say what kind of window this is */
export function currentPath() {
  const url = new URL(location.href)
  url.searchParams.delete('win')
  return `${url.pathname}${url.search}`
}

// This window's own state: whether a pop-out is showing its sidebar, and the
// focus mode that hides everything but what you're reading or writing
const _useWindowChrome = () => {
  const kind = windowKind()
  /** A pop-out starts without the sidebar and shows it when asked */
  const sidebarShown = ref(kind === 'main')
  const focus = ref(false)

  defineAppShortcuts({ 'window.focus': () => (focus.value = !focus.value) })

  // Escape leaves focus mode, once nothing else wants the key
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !focus.value || event.defaultPrevented) return
    if (document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]')) return
    const target = event.target as HTMLElement | null
    if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
    focus.value = false
  })

  return { kind, sidebarShown, focus, isMain: kind === 'main', isPopout: kind === 'popout', isPane: kind === 'pane' }
}

export const useWindowChrome = createAppComposable(_useWindowChrome)
