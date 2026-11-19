<script setup lang="ts">
// Settings → Appearance → Customise. Its own page, wider than the tabs, so
// the preview and the controls fit side by side with the app's sidebar
const appConfig = useAppConfig()
useSeoMeta({ title: 'Theme · Settings' })

// An instance that gives everyone its own look has nothing to customise
if (!appConfig.citrusmail.allowAppearance) await navigateTo('/settings/profile', { replace: true })
</script>

<template>
  <SettingsPage
    title="Theme"
    description="Every color, corner and font of the app. Changes show at once, here and everywhere else."
    wide
    :back="{ label: 'Appearance', to: '/settings/appearance' }"
  >
    <SettingsThemeEditor />
  </SettingsPage>
</template>
