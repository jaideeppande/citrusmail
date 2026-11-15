<script setup lang="ts">
// How readable the text of one mode is on the surfaces it sits on, as WCAG
// ratios. Below 4.5:1 is flagged in words and with an icon, not by color alone
const props = defineProps<{
  mode: 'light' | 'dark'
  pairs: ContrastPair[]
}>()

const low = computed(() => props.pairs.filter(pair => pair.ratio < CONTRAST_AA).length)
</script>

<template>
  <div>
    <p class="mb-2 text-xs font-medium text-muted">
      Contrast in {{ mode }} mode ·
      <span :class="low && 'font-medium text-highlighted'">{{ low ? `${low} ${low === 1 ? 'pair is' : 'pairs are'} hard to read` : 'all readable' }}</span>
    </p>
    <ul class="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      <li
        v-for="pair in pairs"
        :key="pair.label"
        class="flex items-center gap-2 text-sm"
      >
        <UIcon
          :name="pair.ratio < CONTRAST_AA ? 'i-lucide-triangle-alert' : Number.isNaN(pair.ratio) ? 'i-lucide-circle-help' : 'i-lucide-check'"
          class="size-3.5 shrink-0"
          :class="pair.ratio < CONTRAST_AA ? 'text-warning' : 'text-muted'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate text-toned">{{ pair.label }}</span>
        <span class="text-highlighted tabular-nums">{{ formatContrast(pair.ratio) }}</span>
        <span
          v-if="pair.ratio < CONTRAST_AA"
          class="text-xs font-medium text-highlighted"
        >Below 4.5</span>
        <span
          v-else
          class="sr-only"
        >{{ Number.isNaN(pair.ratio) ? 'couldn’t be measured' : 'readable' }}</span>
      </li>
    </ul>
  </div>
</template>
