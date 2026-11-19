<script setup lang="ts">
// Stands in for an opening message below the reader's toolbar: the reading
// column, the subject, the sender with their avatar, then paragraphs
withDefaults(defineProps<{
  label?: string
}>(), {
  label: 'Loading message'
})

const PARAGRAPHS = [[100, 96, 62], [100, 92, 98, 40], [88, 54]]
</script>

<template>
  <SkeletonFrame :label="label">
    <div class="mx-auto flex w-full lb-reader-column flex-col gap-5 px-4 py-6 sm:px-8">
      <span class="flex h-8 items-center">
        <SkeletonBone class="h-5 w-3/5" />
      </span>
      <div class="flex items-start gap-3">
        <SkeletonBone class="size-10 rounded-full" />
        <div class="flex flex-1 flex-col gap-2 pt-1">
          <SkeletonBone class="h-3.5 w-48 max-w-1/2" />
          <SkeletonBone class="h-3 w-32 max-w-1/3" />
        </div>
      </div>
      <div class="flex flex-col gap-6 pt-2">
        <div
          v-for="(lines, paragraph) in PARAGRAPHS"
          :key="paragraph"
          class="flex flex-col gap-2.5"
        >
          <SkeletonBone
            v-for="(width, line) in lines"
            :key="line"
            class="h-3"
            :style="{ width: `${width}%` }"
          />
        </div>
      </div>
    </div>
  </SkeletonFrame>
</template>
