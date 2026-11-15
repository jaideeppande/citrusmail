<script setup lang="ts">
import type { RelationshipPerson } from '~/composables/useAiRelationship'

// A few sentences on your history with someone, written by the AI on a
// click and kept for a week. On a contact's page it waits for the click;
// on the Relationships page it opens from the row's own button (`immediate`)
const props = defineProps<{
  person: RelationshipPerson
  immediate?: boolean
}>()

const relationship = useAiRelationship(() => props.person)
const firstName = computed(() => props.person.name.trim().split(/\s+/)[0] || props.person.name)

const now = useNow({ interval: 60_000 })
const written = computed(() => {
  const entry = relationship.summary.value
  if (!entry) return ''
  const when = now.value.getTime() - entry.at < 60_000 ? 'just now' : formatAgo(entry.at, now.value.getTime())
  return `Written ${when}, from ${entry.count === 1 ? '1 message' : `${entry.count} messages`}`
})

onMounted(() => {
  if (props.immediate && !relationship.summary.value) relationship.summarise()
})

// On a contact's page, one command away too
if (!props.immediate) {
  useCommands(() => relationship.on.value
    ? [{
        id: 'contact-relationship',
        label: 'Contact',
        items: [{
          label: relationship.summary.value ? `Summarise ${props.person.name} again` : `Summarise ${props.person.name}`,
          suffix: 'Your history with them, by AI',
          icon: 'i-lucide-sparkles',
          onSelect: () => relationship.summarise()
        }]
      }]
    : [])
}
</script>

<template>
  <section
    v-if="relationship.on.value"
    class="relative flex flex-col gap-1.5 overflow-hidden rounded-lg bg-(--lb-ai-bg) px-3.5 py-2.5"
    :aria-label="`Your relationship with ${person.name}`"
    :aria-busy="relationship.busy.value"
  >
    <span
      v-if="relationship.busy.value"
      class="lb-ai-progress absolute inset-x-0 top-0 h-px"
      aria-hidden="true"
    />
    <header class="flex items-center gap-2">
      <UIcon
        name="i-lucide-sparkles"
        class="size-3.5 text-(--lb-ai)"
        aria-hidden="true"
      />
      <h2 class="text-xs font-semibold text-highlighted">
        Relationship
      </h2>
      <span
        v-if="written && !relationship.busy.value"
        class="truncate text-xs text-muted"
      >{{ written }}</span>
      <UTooltip
        v-if="relationship.summary.value || relationship.error.value"
        text="Write it again"
      >
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Summarise your mail with ${firstName} again`"
          class="ms-auto -me-1.5"
          :loading="relationship.busy.value"
          @click="relationship.summarise()"
        />
      </UTooltip>
    </header>

    <!-- Shown as it is written; read out once, whole, when it is done -->
    <p
      v-if="relationship.busy.value"
      class="text-sm text-default"
      aria-hidden="true"
    >
      {{ relationship.writing.value }}<span
        v-if="!relationship.writing.value"
        class="text-muted"
      >Reading your mail with {{ firstName }}<span class="lb-ai-dots" /></span>
    </p>

    <p
      v-else-if="relationship.summary.value"
      class="text-sm text-default"
    >
      {{ relationship.summary.value.text }}
    </p>

    <p
      v-else-if="relationship.error.value"
      class="text-sm text-muted"
    >
      {{ relationship.error.value }}
    </p>

    <div
      v-else
      class="flex items-center gap-3"
    >
      <p class="flex-1 text-sm text-muted">
        Your history with {{ firstName }}, the tone lately and anything still open, from your recent mail.
      </p>
      <UButton
        label="Summarise"
        color="neutral"
        variant="soft"
        size="xs"
        class="shrink-0"
        @click="relationship.summarise()"
      />
    </div>
  </section>
</template>
