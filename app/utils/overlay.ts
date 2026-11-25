/**
 * Something is open over the mail, or has the keyboard beside it: a menu, a
 * list of suggestions, a dialog, or a control of the composer. The mail's
 * single-key shortcuts stand down then: a letter typed to jump to a menu item
 * would otherwise also archive, flag or answer the message behind it.
 * (The phone's reader is a slideover, which is the mail itself, not over it)
 */
export function mailOverlayOpen(): boolean {
  return !!document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]:not(:has([data-reader]))')
    || !!document.activeElement?.closest('[data-composer]')
}
