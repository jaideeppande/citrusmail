<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Send, with Send later beside it: a few usual times, or exactly when you choose
const { sending, send } = useComposer()
const { account } = useShell()
const { kbds } = useShortcutKeys()
const prefs = usePrefs()
// Also opened by /later in the editor
const { later: customOpen } = useComposerTools()

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'Send later' }],
  sendLaterPresets().map(preset => ({
    label: preset.label,
    description: scheduleLabel(preset.date.toISOString()),
    icon: preset.icon,
    onSelect: () => send(preset.date)
  })),
  [{ label: 'Custom time…', icon: 'i-lucide-calendar-clock', onSelect: () => (customOpen.value = true) }]
])
</script>

<template>
  <UFieldGroup>
    <UTooltip
      :text="prefs.undoSend > 0 ? 'Send, with a moment to undo' : 'Send'"
      :kbds="kbds('compose.send')"
    >
      <UButton
        label="Send"
        trailing-icon="i-lucide-send-horizontal"
        :loading="sending"
        class="lb-press px-4"
        @click="send()"
      />
    </UTooltip>
    <UDropdownMenu
      v-if="account?.protocol"
      :items="items"
      :content="{ side: 'top', align: 'end' }"
      :ui="{ content: 'min-w-64' }"
    >
      <UButton
        icon="i-lucide-chevron-up"
        aria-label="Send later"
        :disabled="sending"
        class="border-s border-inverted/20 px-2"
      />
    </UDropdownMenu>
  </UFieldGroup>

  <MailSendLaterModal
    v-model:open="customOpen"
    @pick="send"
  />
</template>
