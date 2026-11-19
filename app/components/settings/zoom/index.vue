<script setup lang="ts">
// The desktop app's zoom, per window: 80% to 150% in steps of ten
const MIN = 80
const MAX = 150

const percent = ref(100)

onMounted(async () => {
  const factor = await desktop()?.getZoom().catch(() => 1)
  if (factor) percent.value = Math.round(factor * 100)
})

async function set(value: number) {
  const next = Math.min(MAX, Math.max(MIN, Math.round(value / 10) * 10))
  const factor = await desktop()?.setZoom(next / 100).catch(() => undefined)
  percent.value = factor ? Math.round(factor * 100) : next
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UButton
      icon="i-lucide-minus"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Zoom out"
      :disabled="percent <= MIN"
      @click="set(percent - 10)"
    />
    <output
      class="w-14 text-center text-sm font-medium text-highlighted tabular-nums"
      aria-live="polite"
    >{{ percent }}%</output>
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Zoom in"
      :disabled="percent >= MAX"
      @click="set(percent + 10)"
    />
    <UButton
      v-if="percent !== 100"
      label="Reset"
      color="neutral"
      variant="ghost"
      size="sm"
      class="lb-in ms-1"
      @click="set(100)"
    />
  </div>
</template>
