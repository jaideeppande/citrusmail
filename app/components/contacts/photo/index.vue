<script setup lang="ts">
// A contact’s picture you can click to change. The picture is a square JPEG
// kept on this computer; `update:modelValue` gets the new one, or undefined
// when it is taken away
const props = defineProps<{
  name: string
  /** The address the avatar falls back on for initials and a found picture */
  address?: string
  modelValue?: string
  size?: '2xl' | '3xl'
  disabled?: boolean
  /** Shown as the tooltip when it cannot be changed */
  disabledReason?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [photo: string | undefined]
}>()

const toast = useToast()
const input = useTemplateRef('input')
const busy = ref(false)

const label = computed(() => props.modelValue ? `Change the photo of ${props.name || 'this contact'}` : `Add a photo of ${props.name || 'this contact'}`)

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  busy.value = true
  try {
    emit('update:modelValue', await toContactPhoto(file))
    announce('Photo added')
  } catch {
    toast.add({ title: 'That picture couldn’t be read', description: 'Try a JPEG or PNG.', color: 'error', icon: 'i-lucide-circle-alert' })
    announce('That picture couldn’t be read', true)
  } finally {
    busy.value = false
  }
}

function clear() {
  emit('update:modelValue', undefined)
  announce('Photo removed')
}
</script>

<template>
  <div class="flex flex-col items-center gap-1.5">
    <UTooltip :text="disabled ? disabledReason : modelValue ? 'Change photo' : 'Add a photo'">
      <button
        type="button"
        class="group/photo lb-focus relative rounded-full disabled:cursor-not-allowed"
        :aria-label="label"
        :disabled="disabled || busy"
        @click="input?.click()"
      >
        <UAvatar
          v-if="modelValue"
          :src="modelValue"
          :alt="name"
          :size="size ?? '3xl'"
        />
        <SenderAvatar
          v-else
          :address="{ name, address: address ?? name }"
          :size="size ?? '3xl'"
        />
        <span
          v-if="!disabled"
          class="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-(--lb-dur-1) group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100"
          :class="busy && 'opacity-100'"
          aria-hidden="true"
        >
          <UIcon
            :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-camera'"
            class="size-5"
            :class="busy && 'animate-spin'"
          />
        </span>
      </button>
    </UTooltip>
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="hidden"
      tabindex="-1"
      aria-hidden="true"
      @change="onFile"
    >
    <UButton
      v-if="modelValue && !disabled"
      label="Remove photo"
      color="neutral"
      variant="link"
      size="xs"
      class="p-0 text-muted"
      @click="clear"
    />
  </div>
</template>
