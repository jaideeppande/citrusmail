import type { MaybeElementRef } from '@vueuse/core'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"]), [data-roving]'

/**
 * One Tab stop for a whole row of controls (a toolbar, the dock's tabs):
 * Tab lands on the one used last and the arrow keys, Home and End move along
 * the row. Controls that come and go are picked up as they appear
 */
export function useRovingFocus(target: MaybeElementRef, options: { vertical?: boolean } = {}) {
  let current: HTMLElement | undefined

  const container = () => unrefElement(target) as HTMLElement | undefined
  const items = (): HTMLElement[] => {
    const root = container()
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      // A text field in the row keeps its own arrow keys, so it isn't part of the roving
      .filter(el => !el.matches('input, select, textarea') && el.offsetParent !== null)
  }

  function arrange() {
    const list = items()
    if (!list.length) return
    if (!current || !list.includes(current)) current = list[0]
    for (const el of list) el.tabIndex = el === current ? 0 : -1
  }

  function onFocusIn(event: FocusEvent) {
    const el = event.target as HTMLElement
    if (!items().includes(el)) return
    current = el
    arrange()
  }

  function onKeydown(event: KeyboardEvent) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (index < 0) return
    const back = options.vertical ? 'ArrowUp' : 'ArrowLeft'
    const forward = options.vertical ? 'ArrowDown' : 'ArrowRight'
    let next: number | undefined
    if (event.key === forward) next = (index + 1) % list.length
    else if (event.key === back) next = (index - 1 + list.length) % list.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = list.length - 1
    if (next === undefined) return
    event.preventDefault()
    list[next]!.focus()
  }

  useEventListener(target, 'focusin', onFocusIn)
  useEventListener(target, 'keydown', onKeydown)
  useMutationObserver(target, () => arrange(), { childList: true, subtree: true })
  onMounted(() => nextTick(arrange))

  return { arrange }
}
