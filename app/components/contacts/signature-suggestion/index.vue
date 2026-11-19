<script setup lang="ts">
// What the AI found in this person's latest signature that their contact
// card doesn't say yet. Offered, never applied: Update saves it, Dismiss
// forgets it for good
const props = defineProps<{
  contact: Contact
}>()

const emit = defineEmits<{
  /** It went away: the focus needs somewhere to land */
  done: []
}>()

const signatures = useAiSignatures()
const ai = useAiClient()
const saving = ref(false)

const suggestion = computed(() => ai.enabled('signature') ? signatures.suggestionFor(props.contact) : undefined)
const firstName = computed(() => props.contact.name.trim().split(/\s+/)[0] || props.contact.name)
const line = computed(() => suggestion.value ? signatureLine(suggestion.value) : '')

async function update() {
  saving.value = true
  try {
    await signatures.accept(props.contact)
  } finally {
    saving.value = false
  }
  if (!suggestion.value) emit('done')
}

function dismiss() {
  signatures.dismiss(props.contact)
  emit('done')
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="suggestion">
      <section
        class="flex flex-col gap-2 rounded-lg bg-(--lb-ai-bg) px-3.5 py-2.5"
        aria-label="Suggested contact details"
      >
        <p class="flex items-start gap-2 text-sm">
          <UIcon
            name="i-lucide-sparkles"
            class="mt-0.5 size-4 shrink-0 text-(--lb-ai)"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 text-default">
            <span class="sr-only">Suggested by AI: </span>
            {{ firstName }}’s signature says: <span class="font-medium text-highlighted">{{ line }}</span>
          </span>
        </p>
        <div class="flex items-center gap-1 ps-6">
          <UButton
            label="Update contact"
            size="xs"
            :loading="saving"
            class="lb-press"
            @click="update"
          />
          <UButton
            label="Dismiss"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="dismiss"
          />
        </div>
      </section>
    </div>
  </Transition>
</template>
