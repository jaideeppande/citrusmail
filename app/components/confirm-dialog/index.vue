<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  message?: string
  confirmLabel?: string
  color?: 'error' | 'primary'
}>(), {
  confirmLabel: 'Confirm',
  color: 'error'
})

const emit = defineEmits<{
  close: [confirmed: boolean]
}>()

const cancelButton = useTemplateRef<{ $el: HTMLElement }>('cancelButton')
const confirmButton = useTemplateRef<{ $el: HTMLElement }>('confirmButton')

// Focus lands on the safe choice: Cancel when the action destroys something,
// so a stray Enter keeps it; the action itself when it is harmless. Escape
// always cancels
function focusSafest(event: Event) {
  event.preventDefault()
  const target = props.color === 'error' ? cancelButton.value : confirmButton.value
  target?.$el?.focus()
}
</script>

<template>
  <UModal
    :title="title"
    :description="message"
    :close="false"
    :content="{ onOpenAutoFocus: focusSafest }"
    :ui="{ content: 'sm:max-w-md', footer: 'justify-end gap-2' }"
    @update:open="(open: boolean) => !open && emit('close', false)"
  >
    <template #footer>
      <UButton
        ref="cancelButton"
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="emit('close', false)"
      />
      <UButton
        ref="confirmButton"
        :label="confirmLabel"
        :color="color"
        :icon="color === 'error' ? 'i-lucide-trash-2' : undefined"
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
