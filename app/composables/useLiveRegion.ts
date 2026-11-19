// Says what just happened to people who can't see it happen. A screen
// reader reads whatever lands in the page's live region (mounted once, by
// the layout): "Archived", "3 selected", "Message sent"
const message = ref('')
const urgent = ref('')
let turn = 0

/**
 * Announces `text` to assistive technology. `assertive` interrupts what is
 * being read, and is for errors only
 */
export function announce(text: string, assertive = false) {
  const target = assertive ? urgent : message
  // The same words twice in a row would otherwise not be read the second time
  target.value = ''
  const mine = ++turn
  setTimeout(() => {
    if (mine === turn) target.value = text
  }, 50)
}

export function useLiveRegion() {
  return { message, urgent, announce }
}
