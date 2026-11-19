<script setup lang="ts">
// Stands in for ContactsRow: a small avatar, the name and one line under it.
// Put it where the rows go (inside the list's own padding)
withDefaults(defineProps<{
  count?: number
  label?: string
}>(), {
  count: 8,
  label: 'Loading contacts'
})

const width = (index: number, base: number, step: number, spread: number) => `${base + (index * step) % spread}%`
</script>

<template>
  <SkeletonFrame
    v-slot="{ index }"
    :count="count"
    :label="label"
  >
    <div class="flex items-center gap-3 py-2 ps-3 pe-10">
      <SkeletonBone class="size-7 rounded-full" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex h-5 items-center">
          <SkeletonBone
            class="h-3.5"
            :style="{ width: width(index, 40, 17, 35) }"
          />
        </span>
        <span class="flex h-4 items-center">
          <SkeletonBone
            class="h-2.5"
            :style="{ width: width(index, 30, 11, 30) }"
          />
        </span>
      </span>
    </div>
  </SkeletonFrame>
</template>
