<script setup lang="ts">
// What’s new: a small panel in the bottom-left corner, once after an
// update. Mounted once in the layout; also opened from Settings → About
const { isOpen, unseen, firstRun, open, dismiss, markSeen } = useWhatsNew()
const tour = useAppTour()
const { locked } = useAppLock()
const { isMobile } = useShell()

/** These highlights are waiting to be shown by themselves */
const due = ref(false)
/** Opened by itself rather than asked for: it doesn't take the keyboard then */
let opening = false
const panel = useTemplateRef<HTMLElement>('panel')
let returnTo: HTMLElement | null = null

onMounted(() => {
  if (!unseen.value || windowKind() !== 'main') return
  // Nothing on record means either a first install, which the tour
  // introduces, or the first update to a release that keeps track: told
  // apart by whether the app has been used on this computer before
  const usedBefore = localStorage.getItem('citrusmail-notify-cursors') !== null
  if (firstRun.value && !usedBefore) return markSeen()
  due.value = true
})

// One thing at a time: after the tour, and not over a lock screen
watchEffect(() => {
  if (!due.value || tour.active.value || locked.value) return
  // The tour doesn't run in a narrow window, so there's nothing to wait for there
  if (!tour.done.value && !isMobile.value) return
  due.value = false
  opening = true
  open()
})

// Asked for (from Settings → About or the palette), it takes the keyboard,
// and gives it back where it was when it closes. Opened by itself after an
// update, it only says so, and leaves the keyboard where it is
watch(isOpen, async (on) => {
  const auto = opening
  opening = false
  if (on) {
    if (auto) return announce('What’s new is open, in the bottom corner')
    returnTo = document.activeElement as HTMLElement | null
    await nextTick()
    panel.value?.querySelector<HTMLElement>('[data-whats-new-done]')?.focus()
    return
  }
  if (returnTo?.isConnected) returnTo.focus()
  returnTo = null
})

function shortcuts() {
  dismiss()
  useShortcutsHelp().open()
}
</script>

<template>
  <Transition name="lb-rise">
    <aside
      v-if="isOpen && !locked"
      ref="panel"
      class="fixed bottom-4 left-4 z-40 flex max-h-[calc(100svh-2rem)] w-88 max-w-[calc(100vw-2rem)] flex-col rounded-lg bg-default shadow-(--lb-shadow) ring ring-default"
      aria-labelledby="whats-new-title"
      @keydown.esc.stop="dismiss"
    >
      <header class="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <UIcon
          name="i-lucide-gift"
          class="size-4 text-primary"
        />
        <h2
          id="whats-new-title"
          class="flex-1 text-sm font-semibold text-highlighted"
        >
          What’s new
        </h2>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Close What’s new"
          class="-me-1.5"
          @click="dismiss"
        />
      </header>

      <ul class="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3">
        <li
          v-for="(item, index) in RELEASE_HIGHLIGHTS"
          :key="item.title"
          class="lb-stagger flex gap-3"
          :style="{ '--lb-i': index }"
        >
          <UIcon
            :name="item.icon"
            class="mt-0.5 size-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-highlighted">{{ item.title }}</span>
            <span class="block text-[13px]/5 text-muted">{{ item.text }}</span>
          </span>
        </li>
      </ul>

      <footer class="flex items-center justify-end gap-2 border-t border-default px-4 py-3">
        <UButton
          label="See all shortcuts"
          icon="i-lucide-keyboard"
          color="neutral"
          variant="outline"
          size="sm"
          @click="shortcuts"
        />
        <UButton
          label="Got it"
          size="sm"
          data-whats-new-done
          @click="dismiss"
        />
      </footer>
    </aside>
  </Transition>
</template>
