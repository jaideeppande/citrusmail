<script setup lang="ts">
const { prefs, set } = useNotificationSettings()
</script>

<template>
  <div class="flex flex-col gap-8 max-w-xl">
    <USwitch
      :model-value="prefs.enabled"
      label="Notify me about new mail"
      description="While CitrusMail is open in any tab, it checks every minute or so."
      @update:model-value="set({ enabled: $event })"
    />

    <div
      class="flex flex-col gap-8 transition-opacity duration-(--lb-dur-2)"
      :class="!prefs.enabled && 'opacity-50 pointer-events-none'"
      :inert="!prefs.enabled"
    >
      <SettingsNotificationDelivery />
      <SettingsNotificationSound />
      <SettingsNotificationDnd />
      <SettingsNotificationMailboxes />
    </div>
  </div>
</template>
