<script setup lang="ts">
// Stands in for MailListItem (or MailListItemCompact with `compact`), box for
// box: the same padding, the density variables, avatar and line heights, so
// the list doesn't move when the messages arrive
withDefaults(defineProps<{
  compact?: boolean
  count?: number
  label?: string
}>(), {
  count: 8,
  label: 'Loading messages'
})

// Lines of a few lengths, so a column of them reads like mail and not a grid
const WIDTHS = [[38, 72, 88], [30, 60, 80], [44, 66, 92], [34, 78, 70]]
const width = (index: number, line: number) => `${WIDTHS[index % WIDTHS.length]![line]}%`
</script>

<template>
  <SkeletonFrame
    v-slot="{ index }"
    :count="count"
    :label="label"
  >
    <div
      v-if="compact"
      class="flex h-(--lb-row-compact) items-center gap-3 border-b border-default ps-2 pe-4"
    >
      <span class="size-4 shrink-0" />
      <span class="w-44 shrink-0">
        <SkeletonBone
          class="h-3"
          :style="{ width: width(index, 0) }"
        />
      </span>
      <span class="min-w-0 flex-1">
        <SkeletonBone
          class="h-3"
          :style="{ width: width(index, 1) }"
        />
      </span>
      <SkeletonBone class="h-3 w-10" />
    </div>

    <div
      v-else
      class="flex items-start gap-3 border-b border-default py-(--lb-row-y) ps-2 pe-4"
    >
      <!-- The unread dot's column, kept empty -->
      <span class="w-2 shrink-0" />
      <SkeletonBone class="size-8 rounded-full" />
      <span class="flex min-w-0 flex-1 flex-col gap-(--lb-row-gap)">
        <span class="flex h-[1.34rem] items-center gap-2">
          <SkeletonBone
            class="h-3.5"
            :style="{ width: width(index, 0) }"
          />
          <SkeletonBone class="ms-auto h-3 w-10" />
        </span>
        <span class="flex h-5 items-center">
          <SkeletonBone
            class="h-3"
            :style="{ width: width(index, 1) }"
          />
        </span>
        <span class="flex h-5 items-center">
          <SkeletonBone
            class="h-3"
            :style="{ width: width(index, 2) }"
          />
        </span>
      </span>
    </div>
  </SkeletonFrame>
</template>
