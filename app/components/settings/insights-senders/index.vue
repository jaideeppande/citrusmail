<script setup lang="ts">
import type { InsightSender } from '~/utils/insights'

// Who writes most: a name, a bar as long as their share, and the count
const props = defineProps<{
  senders: InsightSender[]
}>()

const max = computed(() => Math.max(1, ...props.senders.map(sender => sender.count)))
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold text-highlighted">
      Who writes most
    </h2>
    <p class="mt-0.5 mb-3 text-sm text-muted">
      {{ senders.length ? 'By messages in your Inbox over the last 30 days.' : 'Nobody has written in the last 30 days.' }}
    </p>
    <ol class="flex flex-col gap-2.5">
      <li
        v-for="(sender, index) in senders"
        :key="sender.address"
        class="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_2.5rem] items-center gap-3"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm text-highlighted">{{ sender.name || sender.address }}</span>
          <span
            v-if="sender.name"
            class="block truncate text-xs text-muted"
          >{{ sender.address }}</span>
        </span>
        <span
          class="block h-2"
          aria-hidden="true"
        >
          <span
            class="lb-bar-grow-x block h-full min-w-0.5 rounded-e-[3px] bg-(--lb-chart-accent)"
            :style="{ 'width': `${sender.count / max * 100}%`, '--lb-i': index }"
          />
        </span>
        <span class="text-end text-sm text-toned tabular-nums">{{ sender.count.toLocaleString() }}</span>
      </li>
    </ol>
  </section>
</template>
