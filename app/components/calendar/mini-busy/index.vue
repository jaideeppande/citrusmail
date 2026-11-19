<script setup lang="ts">
// The month at a glance in the mail sidebar: which days are busy, the first
// few titles on a day, and a click to open that week in the calendar. Renders
// nothing (and fetches nothing) for a mailbox without a calendar
const { account } = useShell()
const prefs = useLocalPref('mini-calendar', { open: true })

const panelId = useId()

function toggle() {
  prefs.value = { ...prefs.value, open: !prefs.value.open }
}
</script>

<template>
  <section
    v-if="account?.hasCalendar"
    aria-label="Calendar"
    class="flex flex-col"
  >
    <button
      type="button"
      class="lb-focus flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted hover:text-highlighted"
      :aria-expanded="prefs.open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-3.5 transition-transform duration-(--lb-dur-2)"
        :class="prefs.open && 'rotate-90'"
        aria-hidden="true"
      />
      Calendar
    </button>

    <Transition name="lb-collapse">
      <div
        v-if="prefs.open"
        :id="panelId"
      >
        <CalendarMiniBusyMonth />
      </div>
    </Transition>
  </section>
</template>
