<script setup lang="ts">
// A dot crossing a track, moving the way the app will with this choice:
// gliding (full), fading from one end to the other (reduced) or just
// appearing there (off)
const { $motion } = useNuxtApp()

const far = ref(false)
useIntervalFn(() => (far.value = !far.value), 1400)

const CAPTIONS = {
  full: 'Things glide into place.',
  reduced: 'Things fade in where they belong, without travelling.',
  off: 'Things appear at once.'
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="relative h-5 w-24 shrink-0"
      aria-hidden="true"
    >
      <span class="absolute inset-x-0 top-1/2 h-px bg-accented" />
      <span
        v-if="$motion === 'full'"
        class="lb-motion-dot absolute top-1 size-3 rounded-full bg-primary"
        :style="{ left: far ? 'calc(100% - 0.75rem)' : '0%' }"
      />
      <Transition
        v-else
        name="lb-fade"
        mode="out-in"
      >
        <span
          :key="String(far)"
          class="absolute top-1 size-3 rounded-full bg-primary"
          :class="far ? 'right-0' : 'left-0'"
        />
      </Transition>
    </div>
    <p class="text-sm text-muted">
      {{ CAPTIONS[$motion] }}
    </p>
  </div>
</template>
