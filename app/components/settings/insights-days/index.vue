<script setup lang="ts">
import type { InsightDay } from '~/utils/insights'

// Thirty days of mail, a pair of thin bars for each: received in the accent,
// sent in grey. The same numbers are there as a table for anyone who'd
// rather read them
const props = defineProps<{
  days: InsightDay[]
}>()

const asTable = ref(false)
const max = computed(() => niceMax(Math.max(0, ...props.days.flatMap(day => [day.received, day.sent]))))
const height = (value: number) => value ? `max(2px, ${value / max.value * 100}%)` : '0'

const dayName = (date: Date) => date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
const count = (value: number, word: string) => `${value.toLocaleString()} ${word}`
const describe = (day: InsightDay) => `${dayName(day.date)} · ${count(day.received, 'received')}, ${count(day.sent, 'sent')}`
/** A date under every seventh day, counted back from today */
const tick = (index: number) => (props.days.length - 1 - index) % 7 === 0
  ? index === props.days.length - 1 ? 'Today' : props.days[index]!.date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  : ''
</script>

<template>
  <figure>
    <figcaption class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <h2 class="text-sm font-semibold text-highlighted">
        The last 30 days
      </h2>
      <span class="flex-1" />
      <span class="flex items-center gap-1.5 text-xs text-muted">
        <span class="size-2 rounded-[2px] bg-(--lb-chart-accent)" />
        Received
      </span>
      <span class="flex items-center gap-1.5 text-xs text-muted">
        <span class="size-2 rounded-[2px] bg-(--lb-chart-neutral)" />
        Sent
      </span>
      <UButton
        :label="asTable ? 'Show as chart' : 'Show as table'"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="asTable = !asTable"
      />
    </figcaption>

    <div
      v-if="asTable"
      class="lb-in max-h-72 overflow-y-auto rounded-lg ring ring-default"
    >
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-elevated text-xs text-muted">
          <tr>
            <th class="px-3 py-1.5 text-start font-medium">
              Day
            </th>
            <th class="px-3 py-1.5 text-end font-medium">
              Received
            </th>
            <th class="px-3 py-1.5 text-end font-medium">
              Sent
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="day in [...days].reverse()"
            :key="day.date.getTime()"
          >
            <td class="px-3 py-1.5">
              {{ dayName(day.date) }}
            </td>
            <td class="px-3 py-1.5 text-end tabular-nums">
              {{ day.received.toLocaleString() }}
            </td>
            <td class="px-3 py-1.5 text-end tabular-nums">
              {{ day.sent.toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-else
      class="lb-in flex gap-2"
    >
      <!-- The scale: its top and zero, nothing between -->
      <div
        class="flex h-36 w-7 shrink-0 flex-col justify-between text-end text-[11px] leading-none text-muted tabular-nums"
        aria-hidden="true"
      >
        <span class="-translate-y-1/2">{{ max.toLocaleString() }}</span>
        <span class="translate-y-1/2">0</span>
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="relative flex h-36 border-b border-default"
          role="img"
          :aria-label="`Mail received and sent on each of the last 30 days. The table has the numbers.`"
        >
          <span class="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-default" />
          <span class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-default/60" />
          <UTooltip
            v-for="(day, index) in days"
            :key="day.date.getTime()"
            :text="describe(day)"
            :delay-duration="0"
            :content="{ side: 'top' }"
          >
            <div class="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t-sm hover:bg-elevated">
              <span
                class="lb-bar-grow w-full max-w-1.5 rounded-t-[2px] bg-(--lb-chart-accent)"
                :style="{ 'height': height(day.received), '--lb-i': index }"
              />
              <span
                class="lb-bar-grow w-full max-w-1.5 rounded-t-[2px] bg-(--lb-chart-neutral)"
                :style="{ 'height': height(day.sent), '--lb-i': index }"
              />
            </div>
          </UTooltip>
        </div>
        <div
          class="mt-1.5 flex text-[11px] leading-none text-muted"
          aria-hidden="true"
        >
          <span
            v-for="(day, index) in days"
            :key="day.date.getTime()"
            class="flex min-w-0 flex-1 justify-center"
          >
            <span class="whitespace-nowrap">{{ tick(index) }}</span>
          </span>
        </div>
      </div>
    </div>
  </figure>
</template>
