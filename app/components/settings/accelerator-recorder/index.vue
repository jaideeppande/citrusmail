<script setup lang="ts">
// Records a shortcut the whole computer listens for. Press the keys; it
// needs Ctrl, Command or Alt in it so that typing never sets it off
defineProps<{
  /** An Electron accelerator such as 'CommandOrControl+Shift+M'; empty for none */
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [accelerator: string]
}>()

const recording = ref(false)
/** A key was pressed that can't be a system-wide shortcut by itself */
const weak = ref(false)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!recording.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    recording.value = false
    return announce('Cancelled. The shortcut is unchanged.')
  }
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return
  const accelerator = acceleratorFromEvent(event)
  weak.value = !accelerator
  if (!accelerator) return announce(`That needs ${isMac() ? 'Command' : 'Ctrl'} or Alt with it. Try again, or press Escape to cancel.`, true)
  recording.value = false
  emit('update:modelValue', accelerator)
  announce(`Shortcut set to ${acceleratorParts(accelerator).join(' ')}`)
}, { capture: true })

useEventListener(window, 'pointerdown', () => (recording.value = false), { capture: true })

function record() {
  weak.value = false
  recording.value = true
  announce('Press the keys for the new shortcut. Escape cancels.')
}

function remove() {
  emit('update:modelValue', '')
  announce('Shortcut removed')
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span
      v-if="recording"
      class="lb-recording rounded-md px-2.5 py-1 text-sm text-primary ring ring-primary"
    >
      {{ weak ? `Add ${isMac() ? '⌘' : 'Ctrl'} or Alt` : 'Press the keys' }}
      <span class="ms-1 text-xs text-muted">Esc cancels</span>
    </span>
    <span
      v-else-if="modelValue"
      class="flex items-center gap-0.5"
    >
      <UKbd
        v-for="part in acceleratorParts(modelValue)"
        :key="part"
        :value="part"
        variant="soft"
        size="lg"
      />
    </span>
    <span
      v-else
      class="text-sm text-muted"
    >No shortcut</span>

    <UButton
      v-if="!recording"
      :label="modelValue ? 'Change' : 'Set a shortcut'"
      color="neutral"
      variant="outline"
      size="sm"
      @click="record"
    />
    <UButton
      v-if="modelValue && !recording"
      label="Remove"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="remove"
    />
  </div>
</template>
