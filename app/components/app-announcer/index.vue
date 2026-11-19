<script setup lang="ts">
// The page's live regions: whatever `announce()` puts here is read out by a
// screen reader without moving focus. Polite for what you did, assertive for
// errors. Mounted once, by the layout
const { message, urgent } = useLiveRegion()
</script>

<template>
  <div class="sr-only">
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ message }}
    </p>
    <p
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {{ urgent }}
    </p>
  </div>
</template>
