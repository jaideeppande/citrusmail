<script setup lang="ts">
// Said once, when the first key is saved: from now on some features send
// mail to the provider without being asked. The switches are right here
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    title="AI is on"
    description="Some features now work on your new mail by themselves, so they’re ready when you look. Each sends what’s listed to the provider you chose. Turn any of them off here or later in Settings → AI."
    :ui="{ content: 'sm:max-w-xl', footer: 'justify-end' }"
  >
    <template #body>
      <SettingsAiFeatures background />
    </template>
    <template #footer>
      <UButton
        label="Done"
        @click="open = false"
      />
    </template>
  </UModal>
</template>
