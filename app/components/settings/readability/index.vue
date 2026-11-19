<script setup lang="ts">
// Settings → Accessibility: stronger contrast, and bigger text and controls.
// Both kept on this computer, set on <html> by the prefs plugin and answered
// in app/assets/css/settings.css
const prefs = usePrefs()
const systemMore = useMediaQuery('(prefers-contrast: more)')

function setContrast(on: boolean) {
  prefs.value = { ...prefs.value, contrast: on ? 'high' : 'normal' }
  announce(on ? 'Contrast increased' : 'Contrast back to normal')
}

function setLarge(on: boolean) {
  prefs.value = { ...prefs.value, largeText: on }
  announce(on ? 'Larger text and controls on' : 'Larger text and controls off')
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <USwitch
      :model-value="prefs.contrast === 'high'"
      label="Increase contrast"
      :description="systemMore && prefs.contrast !== 'high'
        ? 'Your computer already asks for more contrast, so it’s on. Turn this on to keep it on everywhere.'
        : 'Darker secondary text, visible lines between things and a thicker focus ring.'"
      @update:model-value="setContrast"
    />
    <USwitch
      :model-value="prefs.largeText"
      label="Larger text and controls"
      description="Text one step above your chosen size, and nothing to click smaller than 32 pixels."
      @update:model-value="setLarge"
    />
  </div>
</template>
