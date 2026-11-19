<script setup lang="ts">
// Snooze until a time of your choosing
const { isOpen, messages } = useSnoozePicker()
const { snooze } = useMail()

const pad = (value: number) => String(value).padStart(2, '0')
const local = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

const value = ref('')
watch(isOpen, (open) => {
  if (open) value.value = local(inAnHour())
})

const date = computed(() => value.value ? new Date(value.value) : undefined)
const valid = computed(() => !!date.value && !Number.isNaN(date.value.getTime()) && date.value.getTime() > Date.now())

function confirm() {
  if (!valid.value) return
  snooze(messages.value, date.value!)
  isOpen.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Snooze until"
    description="It leaves the list and comes back at the top, unread, when the time comes. Snoozes are kept on this computer."
    :ui="{ content: 'sm:max-w-sm', footer: 'justify-end' }"
  >
    <template #body>
      <form @submit.prevent="confirm">
        <UInput
          v-model="value"
          type="datetime-local"
          :min="local(new Date())"
          aria-label="Snooze until"
          autofocus
          class="w-full"
        />
        <p
          class="mt-2 text-sm"
          :class="valid ? 'text-muted' : 'text-warning'"
        >
          {{ valid ? `Back ${snoozeLabel(date!)}` : 'Choose a time that hasn’t passed yet.' }}
        </p>
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="isOpen = false"
      />
      <UButton
        label="Snooze"
        icon="i-lucide-alarm-clock"
        :disabled="!valid"
        @click="confirm"
      />
    </template>
  </UModal>
</template>
