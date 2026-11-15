<script setup lang="ts">
// How much the app moves. Kept on this computer. Shown in Appearance and in
// Accessibility: the same control in both
const prefs = usePrefs()

function choose(value: MotionLevel) {
  prefs.value = { ...prefs.value, motion: value }
  announce(`Motion: ${APPEARANCE_MOTION.find(item => item.value === value)?.label}`)
}
</script>

<template>
  <UFormField
    label="Motion"
    description="System follows your computer’s own Reduce motion setting."
  >
    <UTabs
      :model-value="prefs.motion"
      :items="APPEARANCE_MOTION"
      :content="false"
      color="neutral"
      size="sm"
      aria-label="Motion"
      class="mt-1 w-96 max-w-full"
      @update:model-value="choose($event as MotionLevel)"
    />
    <SettingsMotionPreview class="mt-3" />
  </UFormField>
</template>
