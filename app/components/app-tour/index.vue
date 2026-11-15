<script setup lang="ts">
// The first-run tour. The window dims, a rounded hole shows one real
// control at a time and a small card beside it says what it's for. Mounted
// once in the layout; it finds its targets by their `data-tour` attribute
// and leaves out any that aren't on screen
const { active, done, start, finish, cancel } = useAppTour()
const { locked } = useAppLock()
const { account, isMobile } = useShell()
const route = useRoute()

/** Air between a control and the edge of the hole around it */
const PAD = 6
/** Between the hole and the card, and the card and the window's edge */
const GAP = 12

const steps = ref<TourStep[]>([])
const index = ref(0)
const hole = ref({ top: 0, left: 0, width: 0, height: 0 })
const place = ref({ top: 0, left: 0 })
const card = useTemplateRef<HTMLElement>('card')
const step = computed(() => steps.value[index.value])

function find(target: string) {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  const box = element?.getBoundingClientRect()
  return box && box.width > 0 && box.height > 0 ? box : undefined
}

/** Puts the hole over the current target and the card where there's room beside it */
function measure() {
  if (!step.value) return
  const box = find(step.value.target)
  if (!box) return
  const top = Math.max(0, box.top - PAD)
  const left = Math.max(0, box.left - PAD)
  const width = Math.min(window.innerWidth - left, box.width + PAD * 2)
  const height = Math.min(window.innerHeight - top, box.height + PAD * 2)
  hole.value = { top, left, width, height }

  const cardWidth = card.value?.offsetWidth ?? 320
  const cardHeight = card.value?.offsetHeight ?? 180
  const fitX = (value: number) => Math.min(window.innerWidth - cardWidth - GAP, Math.max(GAP, value))
  const fitY = (value: number) => Math.min(window.innerHeight - cardHeight - GAP, Math.max(GAP, value))
  const centerX = fitX(left + width / 2 - cardWidth / 2)
  // Under it, over it, to its right, to its left; inside it when it fills the window
  if (top + height + GAP + cardHeight <= window.innerHeight - GAP) place.value = { top: top + height + GAP, left: centerX }
  else if (top - GAP - cardHeight >= GAP) place.value = { top: top - GAP - cardHeight, left: centerX }
  else if (left + width + GAP + cardWidth <= window.innerWidth - GAP) place.value = { top: fitY(top + 24), left: left + width + GAP }
  else if (left - GAP - cardWidth >= GAP) place.value = { top: fitY(top + 24), left: left - GAP - cardWidth }
  else place.value = { top: fitY(top + height / 2 - cardHeight / 2), left: centerX }
}

async function show(to: number) {
  index.value = to
  await nextTick()
  measure()
  card.value?.querySelector<HTMLElement>('[data-tour-next]')?.focus()
  // The card's buttons keep the focus, so its words are said for it
  const current = steps.value[to]
  if (current) announce(`Step ${to + 1} of ${steps.value.length}: ${current.title}. ${current.text}`)
}

/** Where the keyboard was before the tour, given back when it ends */
let returnTo: HTMLElement | null = null

function next() {
  if (index.value >= steps.value.length - 1) return finish()
  show(index.value + 1)
}

function previous() {
  if (index.value > 0) show(index.value - 1)
}

// The page may still be drawing when the tour is asked for: its targets
// get a couple of seconds to turn up
let waiting: ReturnType<typeof setTimeout> | undefined
watch(active, (on) => {
  clearTimeout(waiting)
  if (!on) {
    steps.value = []
    if (returnTo?.isConnected) returnTo.focus()
    returnTo = null
    return
  }
  returnTo = document.activeElement as HTMLElement | null
  let tries = 0
  const begin = () => {
    const found = TOUR_STEPS.filter(item => find(item.target))
    if (found.length) {
      steps.value = found
      index.value = 0
      // Measured before the first paint, so the hole opens on its target instead of gliding in from a corner
      measure()
      return show(0)
    }
    if (++tries > 8) return cancel()
    waiting = setTimeout(begin, 250)
  }
  begin()
}, { immediate: true })

// Once, the first time the mail page is in front after signing in
let starting: ReturnType<typeof setTimeout> | undefined
watchEffect(() => {
  clearTimeout(starting)
  const ready = route.path.startsWith('/mail') && !!account.value && !done.value && !active.value && !locked.value && !isMobile.value
  if (ready && windowKind() === 'main') starting = setTimeout(start, 900)
})
// A lock screen coming up puts the tour away for another time
watch(locked, on => on && active.value && cancel())
onBeforeUnmount(() => {
  clearTimeout(starting)
  clearTimeout(waiting)
})

// The window changes under the tour: resized, scrolled, a pane opened
useEventListener(window, 'resize', measure)
useEventListener(window, 'scroll', measure, { capture: true, passive: true })
useIntervalFn(() => steps.value.length && measure(), 400)

// The tour has the keyboard while it's up: Escape skips, the arrows move,
// and nothing reaches the shortcuts of the app behind it
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!steps.value.length) return
  event.stopPropagation()
  if (event.key === 'Escape') finish()
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next()
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') previous()
  else if (event.key === 'Tab') {
    // Focus stays on the card's own buttons
    const buttons = [...(card.value?.querySelectorAll<HTMLElement>('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLElement)
    buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
  } else if ((event.key === 'Enter' || event.key === ' ') && card.value?.contains(event.target as Node)) {
    // A button on the card, pressed the ordinary way
    return
  }
  event.preventDefault()
}, { capture: true })

const px = (box: Record<string, number>) => Object.fromEntries(Object.entries(box).map(([key, value]) => [key, `${Math.round(value)}px`]))
</script>

<template>
  <Teleport to="body">
    <Transition name="lb-fade">
      <div
        v-if="step"
        class="fixed inset-0 z-900 [-webkit-app-region:no-drag]"
      >
        <div
          class="lb-tour-hole pointer-events-none fixed rounded-[10px]"
          :style="px(hole)"
        />
        <div
          ref="card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-tour-title"
          aria-describedby="app-tour-text"
          class="lb-tour-card fixed w-80 rounded-lg bg-default p-4 shadow-(--lb-shadow) ring ring-default"
          :style="px(place)"
        >
          <div
            :key="step.target"
            class="lb-in"
          >
            <p class="text-xs font-medium text-muted">
              Step {{ index + 1 }} of {{ steps.length }}
            </p>
            <h2
              id="app-tour-title"
              class="mt-0.5 text-sm font-semibold text-highlighted"
            >
              {{ step.title }}
            </h2>
            <p
              id="app-tour-text"
              class="mt-1 text-sm text-muted"
            >
              {{ step.text }}
            </p>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <span
              class="flex flex-1 items-center gap-1.5"
              aria-hidden="true"
            >
              <span
                v-for="(item, at) in steps"
                :key="item.target"
                class="h-1.5 rounded-full transition-all duration-(--lb-dur-3) ease-(--lb-ease-out)"
                :class="at === index ? 'w-4 bg-primary' : 'w-1.5 bg-accented'"
              />
            </span>
            <UButton
              label="Skip"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Skip the tour"
              @click="finish"
            />
            <UButton
              v-if="index > 0"
              label="Back"
              color="neutral"
              variant="outline"
              size="sm"
              @click="previous"
            />
            <UButton
              :label="index === steps.length - 1 ? 'Done' : 'Next'"
              size="sm"
              data-tour-next
              @click="next"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
