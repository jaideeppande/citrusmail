<script setup lang="ts">
// Settings → Accessibility: the choices that make the app easier to see,
// hear and use, gathered in one place. Each control is the same one that
// appears on its home tab; this page only puts them together
const shortcutKeys = useShortcutKeys()
const paletteKeys = computed(() => shortcutKeys.kbds('app.palette'))
</script>

<template>
  <div class="flex flex-col gap-10">
    <SettingsSection
      title="Seeing"
      description="Kept on this computer."
    >
      <SettingsReadability />
    </SettingsSection>

    <SettingsSection title="Moving">
      <SettingsMotionChoice />
    </SettingsSection>

    <SettingsSection title="Hearing">
      <SettingsUiSounds />
    </SettingsSection>

    <SettingsSection title="Keyboard">
      <p class="text-sm text-muted">
        Everything can be done from the keyboard. Press
        <UKbd
          v-for="key in paletteKeys"
          :key="key"
          :value="key"
          variant="soft"
        />
        to find any command, or
        <UKbd
          value="?"
          variant="soft"
        />
        to see every key.
        <ULink
          to="/settings/shortcuts"
          class="font-medium text-primary underline-offset-2 hover:underline"
        >Change your keys in Shortcuts</ULink>.
      </p>
    </SettingsSection>
  </div>
</template>
