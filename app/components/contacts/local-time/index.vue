<script setup lang="ts">
// The clock on their wall, next to their time zone: “Tue 14:05, 3 h ahead
// of you”. Ticks once a minute
const props = defineProps<{
  zone: string
}>()

const now = useNow({ interval: 60_000 })
const time = computed(() => contactZoneTime(props.zone, now.value))
const difference = computed(() => contactZoneDifference(props.zone, now.value))
</script>

<template>
  <span
    v-if="time"
    class="text-sm text-toned tabular-nums"
  >
    <span class="text-highlighted">{{ time }}</span> their time<template v-if="difference">, {{ difference }}</template>
  </span>
</template>
