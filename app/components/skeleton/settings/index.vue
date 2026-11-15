<script setup lang="ts">
// Stands in for a Settings page's fields while what they show is fetched: a
// label, its description and the control, spaced as SettingsPage spaces them
withDefaults(defineProps<{
  /** How many fields */
  count?: number
  label?: string
}>(), {
  count: 4,
  label: 'Loading settings'
})
</script>

<template>
  <SkeletonFrame
    v-slot="{ index }"
    :count="count"
    :label="label"
    class="flex flex-col gap-8"
  >
    <div class="flex flex-col">
      <span class="flex h-5 items-center">
        <SkeletonBone
          class="h-3.5"
          :style="{ width: `${6 + (index * 3) % 5}rem` }"
        />
      </span>
      <span class="flex h-5 items-center">
        <SkeletonBone
          class="h-3"
          :style="{ width: `${55 + (index * 13) % 30}%` }"
        />
      </span>
      <SkeletonBone class="mt-2 h-8 w-48 rounded-md" />
    </div>
  </SkeletonFrame>
</template>
