<script setup lang="ts">
import type { SignInAdvice } from '~/utils/sign-in-errors'

defineProps<{
  /** An error about the password, shown under it and linked to it */
  advice?: SignInAdvice | null
}>()

const password = defineModel<string>({ required: true })
const shown = ref(false)

// Caps Lock is only knowable from a key event, so it's read on every key
// while the field has focus and forgotten when it loses it
const capsLock = ref(false)
function readCapsLock(event: KeyboardEvent) {
  capsLock.value = event.getModifierState?.('CapsLock') ?? false
}
watch(capsLock, (on) => {
  if (on) announce('Caps Lock is on')
})

const input = useTemplateRef<{ inputRef?: HTMLInputElement | null }>('input')
defineExpose({
  focus: () => input.value?.inputRef?.focus()
})
</script>

<template>
  <!-- The Caps Lock note is the field's help text, so it is read with it -->
  <UFormField
    label="Password"
    name="password"
    :error="advice ? advice.message : undefined"
    :help="capsLock ? 'Caps Lock is on' : undefined"
    :ui="{ help: 'font-medium text-toned' }"
  >
    <UInput
      ref="input"
      v-model="password"
      :type="shown ? 'text' : 'password'"
      autocomplete="current-password"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      size="xl"
      required
      class="w-full"
      :ui="{ trailing: 'pe-1.5' }"
      @keydown="readCapsLock"
      @keyup="readCapsLock"
      @blur="capsLock = false"
    >
      <template #trailing>
        <UButton
          :icon="shown ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="shown ? 'Hide password' : 'Show password'"
          :aria-pressed="shown"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="shown = !shown"
        />
      </template>
    </UInput>

    <template
      v-if="advice"
      #error
    >
      <span class="flex flex-col gap-1">
        <span>{{ advice.message }}</span>
        <ULink
          v-if="advice.link"
          :to="advice.link.to"
          target="_blank"
          rel="noopener"
          class="inline-flex w-fit items-center gap-0.5 font-medium text-highlighted underline"
        >
          {{ advice.link.label }}
          <UIcon
            name="i-lucide-arrow-up-right"
            class="size-3.5"
          />
        </ULink>
        <span
          v-if="advice.detail"
          class="text-xs text-muted"
        >{{ advice.detail }}</span>
      </span>
    </template>
  </UFormField>
</template>
