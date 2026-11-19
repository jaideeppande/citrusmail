<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<!-- The label lights up while its field has the cursor, so you always know which line you're on -->
<template>
  <div class="group/field relative flex min-h-10 items-center gap-3 border-b border-default px-5 transition-colors duration-(--lb-dur-1) focus-within:bg-(--lb-field-active)">
    <span
      aria-hidden="true"
      class="absolute inset-y-2 start-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-(--lb-dur-2) ease-out group-focus-within/field:scale-y-100"
    />
    <span class="w-14 shrink-0 text-[13px] text-muted transition-colors duration-(--lb-dur-1) group-focus-within/field:font-medium group-focus-within/field:text-primary">{{ label }}</span>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
