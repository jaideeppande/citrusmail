<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Which signature goes under this message: the default one from Settings,
// one of your others, or none. Also opened with /sign
const { draft } = useComposer()
const { extras, choiceOf, labelOf, hasDefault } = useSignatures()
const tools = useComposerTools()

const choice = computed(() => choiceOf(draft.value))

function choose(value: SignatureChoice) {
  if (value === 'none') {
    draft.value.signature = false
  } else {
    draft.value.signature = true
    draft.value.signatureId = value === 'default' ? undefined : value
  }
  announce(value === 'none' ? 'No signature' : `Signature: ${labelOf(value)}`)
}

const items = computed<DropdownMenuItem[][]>(() => {
  const option = (value: SignatureChoice, label: string, description?: string): DropdownMenuItem => ({
    type: 'checkbox',
    label,
    description,
    checked: choice.value === value,
    onSelect: () => choose(value)
  })
  return [
    [{ type: 'label', label: 'Signature' }],
    [
      option('default', 'Default', hasDefault.value ? 'From Settings → Signature' : 'Not set up yet'),
      ...extras.value.map(item => option(item.id, item.name)),
      option('none', 'None')
    ],
    [{ label: 'Manage signatures…', icon: 'i-lucide-settings-2', onSelect: () => (tools.manageSignatures.value = true) }]
  ]
})
</script>

<template>
  <UDropdownMenu
    v-model:open="tools.signature.value"
    :items="items"
    :content="{ side: 'top', align: 'start' }"
    :ui="{ content: 'min-w-60' }"
  >
    <UTooltip :text="`Signature: ${labelOf(choice)}`">
      <UButton
        icon="i-lucide-signature"
        color="neutral"
        variant="ghost"
        :aria-label="`Signature: ${labelOf(choice)}`"
        :class="choice === 'none' && 'text-muted'"
      />
    </UTooltip>
  </UDropdownMenu>

  <MailComposerSignaturesDialog v-model:open="tools.manageSignatures.value" />
</template>
