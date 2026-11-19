<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { TabsItem } from '@nuxt/ui'

definePageMeta({
  // Date changes update the mounted view in place, the default key would
  // remount the page (and reset the month view scroll) on every URL sync
  key: route => route.params.view as string,
  validate(route) {
    if (!['day', 'week', 'month', 'year', 'agenda'].includes(route.params.view as string)) {
      return false
    }

    try {
      parseDate(route.params.date as string)
      return true
    } catch {
      return false
    }
  },
  // The month view scrolls continuously and syncs the URL as it goes,
  // sliding view transitions would fight the scroll
  middleware: [(to, from) => {
    if (to.params.view === 'month' && from?.params.view === 'month') {
      to.meta.viewTransition = false
    }
  }]
})

const { view, date, title, monthLabelsVisible, prevDate, nextDate, pathFor, setDirection, isSidebarOpen } = useCalendar()
const { online, queue } = useCalendarEvents()
const { account } = useShell()
const { second, pickerOpen } = useCalendarZones()
const findTime = useFindTime()
const { kbds } = useShortcutKeys()
useCalendarCommands()

useSeoMeta({ title: 'Calendar' })

const route = useRoute()

// The agenda is read off the route itself, so it shows whether or not the
// shared calendar state has learnt its name yet
const currentView = computed<CalendarViewName>(() => route.params.view === 'agenda' ? 'agenda' : view.value)
const agenda = computed(() => currentView.value === 'agenda')

const views = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'Agenda', value: 'agenda' }
] satisfies TabsItem[]

// The agenda reads on from its date, so it is titled by the month it opens
// in and steps a week at a time
const heading = computed(() => agenda.value
  ? { months: formatMonth(toDate(date.value)), year: String(date.value.year) }
  : title.value)

const prevPath = computed(() => agenda.value ? calendarPath(date.value.subtract({ days: 7 }), 'agenda') : pathFor(prevDate.value))
const nextPath = computed(() => agenda.value ? calendarPath(date.value.add({ days: 7 }), 'agenda') : pathFor(nextDate.value))
const todayPath = computed(() => calendarPath(todayDate(), currentView.value))

const menu = computed(() => [[{
  label: 'Find a time',
  icon: 'i-lucide-calendar-search',
  onSelect: () => findTime.start()
}, {
  label: 'Time zones…',
  icon: 'i-lucide-globe',
  suffix: second.value ? calZoneCity(second.value) : undefined,
  onSelect: () => {
    pickerOpen.value = true
  }
}]])

// The room the title has, handed to the month labels that dock on it so they
// cut off where it does rather than running under the switcher
const headingEl = useTemplateRef('headingEl')
const { width: headingWidth } = useElementSize(headingEl)

function onViewChange(value: string | number) {
  navigateTo(calendarPath(date.value, value as CalendarViewName))
}
</script>

<template>
  <ServiceNotConnected
    v-if="!account?.hasCalendar"
    feature="calendar"
    class="flex-1"
  />
  <div
    v-else
    class="relative flex-1 flex flex-col overflow-hidden -z-1"
    :style="headingWidth ? { '--heading-width': `${headingWidth}px` } : undefined"
  >
    <!-- Floating over the views so their content scrolls behind the blur, its
      own view transition name keeps it above the sliding grid snapshot (which
      is lifted into the transition overlay, out of reach of the blur) -->
    <header class="absolute top-0 pt-2 inset-x-0 z-10 flex items-center gap-2 sm:gap-4 h-[calc(var(--ui-header-height)+0.5rem)] px-4 border-b border-default glass-material [view-transition-name:header]">
      <!-- The tint rides its own layer so it can run solid at the top and
        dissolve towards the grid instead of ending on a line. Solid up there
        because rows scrolled past the viewport stop being sampled by the
        filter, and anything less than opaque shows their remains clipping
        mid-band. The blur itself stays uniform: masking it away anywhere
        just uncovers sharp content -->
      <div class="pointer-events-none absolute inset-0 -z-10 bg-(--glass-bg) bg-linear-to-b from-default from-40% to-transparent" />

      <!-- Its own gap rather than the header's, so the title starts at the
        same spot at every width the menu button shows at and the month view
        has a single offset to dock its labels on -->
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <!-- Below `lg` the sidebar is a slideover, this is what opens it. It
          grows a size on a touch screen, and the month labels dock past it at
          that width too -->
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="soft"
          size="sm"
          aria-label="Open menu"
          class="lg:hidden shrink-0"
          @click="isSidebarOpen = true"
        />

        <!-- The month view slides its own copy of this title over the top
          while it scrolls, docking it right here, so this one steps aside for
          as long as they are up. Both sit at the same spot, and it steps aside
          without fading: two copies of the same text at half opacity each come
          out lighter than one at full, so a crossfade dips in the middle. It
          holds instead until the arriving label is all the way in, and is back
          before the leaving one starts out, always opaque under a partly
          transparent copy of itself -->
        <h1
          ref="headingEl"
          class="flex items-baseline gap-1.5 text-xl sm:text-2xl tracking-tight min-w-0 flex-1 transition-opacity duration-0"
          :class="view === 'month' && monthLabelsVisible ? 'opacity-0 delay-150' : 'opacity-100'"
        >
          <span class="font-semibold text-highlighted truncate">{{ heading.months }}</span>
          <span class="font-normal text-muted hidden sm:inline">{{ heading.year }}</span>
        </h1>
      </div>

      <!-- Down to the initial below `sm`, where the header cannot spare the
        width for the labels, each in a 24px circle with the track hugging
        them. On a touch screen the track pads out to stand as tall as the
        buttons beside it -->
      <!-- Reka's tabs: a tablist whose arrows move between the views -->
      <nav
        aria-label="Calendar view"
        class="mx-auto"
      >
        <UTabs
          :items="views"
          :content="false"
          :model-value="currentView"
          color="neutral"
          size="sm"
          class="sm:w-64 sm:pointer-coarse:w-68 lg:w-76"
          :ui="{
            list: 'max-sm:pointer-coarse:p-1.5',
            indicator: 'max-sm:pointer-coarse:inset-y-1.5',
            trigger: 'p-1 lg:p-1.5 max-sm:size-6 max-sm:p-0 max-sm:grow-0 max-sm:justify-center'
          }"
          @update:model-value="onViewChange"
        >
          <template #default="{ item }">
            <!-- The letter is for the eye; a screen reader hears the whole name -->
            <span
              class="sm:hidden"
              aria-hidden="true"
            >{{ item.label.charAt(0) }}</span>
            <span class="max-sm:sr-only">{{ item.label }}</span>
          </template>
        </UTabs>
      </nav>

      <!-- Only the title grows below `md`, so the switcher and the controls
        stay together on the end rather than drifting apart -->
      <div class="flex items-center gap-2 md:flex-1 justify-end">
        <UTooltip
          v-if="!online"
          text="Changes are kept locally and sync when you reconnect"
        >
          <UBadge
            icon="i-lucide-cloud-off"
            color="warning"
            variant="soft"
            :label="queue.length ? `Offline (${queue.length})` : 'Offline'"
          />
        </UTooltip>

        <UTheme :props="{ button: { color: 'neutral', variant: 'subtle', size: 'sm' } }">
          <div class="flex items-center gap-1">
            <UTooltip
              text="Previous"
              :kbds="kbds('calendar.prev')"
            >
              <UButton
                icon="i-lucide-chevron-left"
                aria-label="Previous"
                prefetch-on="interaction"
                :to="prevPath"
                @click="setDirection('left')"
              />
            </UTooltip>
            <UTooltip
              text="Today"
              :kbds="kbds('calendar.today')"
            >
              <UButton
                label="Today"
                class="hidden sm:inline-flex"
                :to="todayPath"
              />
            </UTooltip>
            <UTooltip
              text="Next"
              :kbds="kbds('calendar.next')"
            >
              <UButton
                icon="i-lucide-chevron-right"
                aria-label="Next"
                prefetch-on="interaction"
                :to="nextPath"
                @click="setDirection('right')"
              />
            </UTooltip>
          </div>
        </UTheme>

        <UTooltip text="Find a time">
          <UButton
            icon="i-lucide-calendar-search"
            color="neutral"
            :variant="findTime.active.value ? 'soft' : 'ghost'"
            size="sm"
            aria-label="Find a time"
            :aria-pressed="findTime.active.value"
            class="max-md:hidden"
            @click="findTime.active.value ? findTime.stop() : findTime.start()"
          />
        </UTooltip>

        <UDropdownMenu
          :items="menu"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Calendar options"
          />
        </UDropdownMenu>
      </div>
    </header>

    <!-- The view transition name lives on each view's scroller: naming this
      wrapper would create a stacking context and keep the month labels from
      painting above the translucent header -->
    <div class="flex-1 flex flex-col min-h-0">
      <CalendarAgenda v-if="agenda" />
      <CalendarMonthView v-else-if="view === 'month'" />
      <CalendarYearView v-else-if="view === 'year'" />
      <CalendarWeekView v-else />
    </div>

    <CalendarFindTimeBar />
    <CalendarZonePicker />

    <!-- One card for every event on the page, shown beside whichever the
      pointer rests on -->
    <CalendarEventPeek />

    <!-- The phone toolbar, down where the thumb is, the way iOS keeps Today
      and its actions. Today stands in for the header one that has no room
      below `sm`, and `+` for the sidebar one that is a menu away below `lg`.
      These float over the grid itself, so they carry the blur the header
      buttons borrow from the header -->
    <div class="lg:hidden absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between pointer-events-none *:pointer-events-auto">
      <UButton
        label="Today"
        color="neutral"
        variant="soft"
        size="sm"
        class="sm:hidden glass-material"
        :to="todayPath"
      />

      <div class="ms-auto">
        <NewEventMenu floating />
      </div>
    </div>
  </div>
</template>
