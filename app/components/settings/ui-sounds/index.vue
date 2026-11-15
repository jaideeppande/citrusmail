<script setup lang="ts">
// Settings → Notifications and Accessibility: quiet notes when something you
// did has happened (sent, archived, snoozed, undone). Off unless turned on
const prefs = usePrefs()

function toggle(on: boolean) {
  prefs.value = { ...prefs.value, uiSounds: on }
  announce(on ? 'Sounds on' : 'Sounds off')
  // A first taste, so it's plain what was turned on
  if (on) nextTick(() => playUiSound('send'))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <USwitch
      :model-value="prefs.uiSounds"
      label="Sounds for what you do"
      description="A soft note when a message is sent, archived, snoozed or brought back. Separate from the sound for new mail."
      @update:model-value="toggle"
    />
    <UButton
      label="Play a sample"
      icon="i-lucide-volume-2"
      color="neutral"
      variant="outline"
      size="sm"
      class="ms-11 self-start"
      :disabled="!prefs.uiSounds"
      @click="playUiSound('send')"
    />
  </div>
</template>
