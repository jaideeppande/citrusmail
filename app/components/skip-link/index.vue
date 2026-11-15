<script setup lang="ts">
// The first thing Tab reaches: a way past the sidebar straight to what the
// page is about. Hidden until it has focus
function skip(event: MouseEvent) {
  const target = document.getElementById('main')
  if (!target) return
  event.preventDefault()
  // The first thing in the page that takes focus, or the page itself
  const first = target.querySelector<HTMLElement>('[data-id], input, button, a[href], [tabindex]:not([tabindex="-1"])')
  ;(first ?? target).focus()
}
</script>

<template>
  <a
    href="#main"
    class="fixed top-2 start-2 z-100 px-3 py-2 rounded-md bg-inverted text-inverted text-sm font-medium shadow-lg -translate-y-16 focus:translate-y-0 transition-transform duration-(--lb-dur-2) lb-focus"
    @click="skip"
  >Skip to content</a>
</template>
