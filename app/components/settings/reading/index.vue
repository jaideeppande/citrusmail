<script setup lang="ts">
const { settings, save } = useSettings()
const { view } = useMailLayout()

const VIEWS = [
  { label: 'List and message', value: 'split', icon: 'i-lucide-columns-2' },
  { label: 'List only', value: 'list', icon: 'i-lucide-rows-3' }
]

const REMOTE = [
  { value: 'allowed', label: 'From senders you allow', description: 'Mail from people on your allow list shows its pictures. For anyone else, one click shows them.' },
  { value: 'ask', label: 'Ask every time', description: 'Pictures stay hidden until you choose to show them. Senders can’t tell you’ve opened their mail.' },
  { value: 'always', label: 'Always', description: 'Every message shows its pictures. Senders that track opens will know when you read their mail.' }
]

// How mail is grouped, sorted and sent is kept on this computer
const prefs = usePrefs()
function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs.value = { ...prefs.value, [key]: value }
}

const UNDO = [
  { label: 'Off', value: 0 },
  { label: '5 seconds', value: 5 },
  { label: '10 seconds', value: 10 },
  { label: '20 seconds', value: 20 },
  { label: '30 seconds', value: 30 }
]
const NUDGE = [
  { label: 'Off', value: 0 },
  { label: 'After 2 days', value: 2 },
  { label: 'After 3 days', value: 3 },
  { label: 'After 5 days', value: 5 },
  { label: 'After 7 days', value: 7 }
]

const { ready } = useAi()
const languages = Object.entries(LANGUAGES).map(([value, item]) => ({ value, label: item.name, description: item.native }))
const language = computed({
  get: () => settings.value.language || 'en',
  set: (value: string) => save({ language: value }, `Messages will be translated into ${languageName(value)}`)
})

const remote = computed({
  get: () => settings.value.remoteImages ?? 'allowed',
  set: (value: RemoteImages) => save({ remoteImages: value }, 'Saved')
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <UFormField
      label="Layout"
      description="With the list only, a message opens over the list and Escape goes back. Shift+V switches between them."
    >
      <UTabs
        v-model="view"
        :items="VIEWS"
        :content="false"
        color="neutral"
        size="sm"
        class="w-96 max-w-full mt-1"
      />
    </UFormField>

    <div class="flex flex-col gap-5 max-w-xl">
      <USwitch
        :model-value="prefs.threading"
        label="Group conversations"
        description="A message and its replies share one row in the list and open together, oldest first."
        @update:model-value="setPref('threading', $event)"
      />
      <USwitch
        :model-value="prefs.splitInbox"
        label="Split the Inbox into tabs"
        description="People, Newsletters, Notifications and Tracked each get a tab over the Inbox."
        @update:model-value="setPref('splitInbox', $event)"
      />
      <USwitch
        :model-value="prefs.screening"
        label="Screen new senders"
        description="Mail from someone who has never written before waits in Screen until you let them in or block them."
        @update:model-value="setPref('screening', $event)"
      />
    </div>

    <UFormField
      label="Undo send"
      description="A message waits this long before it leaves, so you can take it back."
    >
      <USelect
        :model-value="prefs.undoSend"
        :items="UNDO"
        class="w-48 mt-1"
        @update:model-value="setPref('undoSend', Number($event))"
      />
    </UFormField>

    <UFormField
      label="Follow-up reminders"
      description="A message you sent that nobody has answered comes back to your attention."
    >
      <USelect
        :model-value="prefs.nudgeDays"
        :items="NUDGE"
        class="w-48 mt-1"
        @update:model-value="setPref('nudgeDays', Number($event))"
      />
    </UFormField>

    <UFormField
      label="Your language"
      :description="ready ? 'AI Translate offers to translate messages written in anything else, and translates them into this.' : 'AI Translate uses this once you add a key in Settings → AI.'"
    >
      <USelectMenu
        v-model="language"
        :items="languages"
        value-key="value"
        class="w-64 mt-1"
      />
    </UFormField>

    <UFormField
      label="Show pictures from the web"
      description="Pictures in a message can be loaded from the sender’s server, which tells them you opened it."
    >
      <URadioGroup
        v-model="remote"
        :items="REMOTE"
        variant="card"
        class="mt-2 max-w-xl"
      />
    </UFormField>
  </div>
</template>
