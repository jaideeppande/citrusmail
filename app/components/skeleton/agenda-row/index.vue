<script setup lang="ts">
// Stands in for TodayPanelEvent: the times, the calendar's colour bar, the
// title and the line under it
withDefaults(defineProps<{
  count?: number
  label?: string
}>(), {
  count: 2,
  label: 'Loading events'
})
</script>

<template>
  <SkeletonFrame
    v-slot="{ index }"
    :count="count"
    :label="label"
  >
    <div class="flex items-stretch gap-3 px-2 py-1.5">
      <span class="flex w-11 shrink-0 flex-col justify-center gap-2">
        <SkeletonBone class="h-2.5 w-9" />
        <SkeletonBone class="h-2.5 w-7" />
      </span>
      <SkeletonBone class="w-1 rounded-full" />
      <span class="flex min-w-0 flex-1 flex-col py-0.5">
        <span class="flex h-5 items-center">
          <SkeletonBone
            class="h-3.5"
            :style="{ width: `${72 - (index % 3) * 14}%` }"
          />
        </span>
        <span class="flex h-4 items-center">
          <SkeletonBone class="h-2.5 w-1/3" />
        </span>
      </span>
    </div>
  </SkeletonFrame>
</template>
