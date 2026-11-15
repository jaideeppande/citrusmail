<script setup lang="ts">
// When mail arrives: one bar for each hour of the day
const props = defineProps<{
  hours: number[]
}>()

const max = computed(() => niceMax(Math.max(0, ...props.hours)))
const total = computed(() => props.hours.reduce((sum, value) => sum + value, 0))
const height = (value: number) => value ? `max(2px, ${value / max.value * 100}%)` : '0'

const clock = (hour: number) => new Date(2000, 0, 1, hour % 24).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const describe = (hour: number) => `${clock(hour)} to ${clock(hour + 1)} · ${props.hours[hour]!.toLocaleString()} received`

/** The hour most mail comes in, said in a sentence so the chart isn't the only way to learn it */
const busiest = computed(() => {
  if (!total.value) return ''
  const hour = props.hours.indexOf(Math.max(...props.hours))
  return `Most of your mail arrives between ${clock(hour)} and ${clock(hour + 1)}.`
})
</script>

<template>
  <figure>
    <figcaption class="mb-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Busiest hours
      </h2>
      <p class="mt-0.5 text-sm text-muted">
        {{ busiest || 'No mail in the last 30 days to go on.' }}
      </p>
    </figcaption>

    <div class="flex gap-2">
      <div
        class="flex h-24 w-7 shrink-0 flex-col justify-between text-end text-[11px] leading-none text-muted tabular-nums"
        aria-hidden="true"
      >
        <span class="-translate-y-1/2">{{ max.toLocaleString() }}</span>
        <span class="translate-y-1/2">0</span>
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="relative flex h-24 border-b border-default"
          role="img"
          :aria-label="`Mail received in each hour of the day over the last 30 days. ${busiest}`"
        >
          <span class="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-default" />
          <UTooltip
            v-for="(value, hour) in hours"
            :key="hour"
            :text="describe(hour)"
            :delay-duration="0"
            :content="{ side: 'top' }"
          >
            <div class="flex h-full min-w-0 flex-1 items-end justify-center rounded-t-sm px-px hover:bg-elevated">
              <span
                class="lb-bar-grow w-full max-w-3 rounded-t-[3px] bg-(--lb-chart-accent)"
                :style="{ 'height': height(value), '--lb-i': hour }"
              />
            </div>
          </UTooltip>
        </div>
        <div
          class="mt-1.5 flex text-[11px] leading-none text-muted"
          aria-hidden="true"
        >
          <span
            v-for="(value, hour) in hours"
            :key="hour"
            class="flex min-w-0 flex-1 justify-center"
          >
            <span
              v-if="hour % 6 === 0"
              class="whitespace-nowrap"
            >{{ clock(hour) }}</span>
          </span>
        </div>
      </div>
    </div>
  </figure>
</template>
