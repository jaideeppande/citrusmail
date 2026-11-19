<script setup lang="ts">
// A card on its way: an optional picture (attachments, the Later board), a
// title and a line or two
withDefaults(defineProps<{
  count?: number
  /** A 4:3 picture at the top */
  media?: boolean
  /** Lines of text under the title */
  lines?: number
  label?: string
}>(), {
  count: 1,
  lines: 2,
  label: 'Loading'
})
</script>

<template>
  <SkeletonFrame
    v-slot="{ index }"
    :count="count"
    :label="label"
  >
    <div class="flex flex-col gap-2.5 rounded-lg p-3 ring ring-default">
      <SkeletonBone
        v-if="media"
        class="aspect-4/3 w-full rounded-md"
      />
      <SkeletonBone
        class="h-3.5"
        :style="{ width: `${70 - (index % 3) * 10}%` }"
      />
      <SkeletonBone
        v-for="line in lines"
        :key="line"
        class="h-3"
        :style="{ width: line === lines ? '50%' : '90%' }"
      />
    </div>
  </SkeletonFrame>
</template>
