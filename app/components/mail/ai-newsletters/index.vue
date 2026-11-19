<script setup lang="ts">
// The Subscriptions page's suggestions: lists the AI thinks you could leave,
// each with its reason. Ticking one ticks it in the page's own selection,
// so the same "Unsubscribe from selected" does the leaving
const props = defineProps<{
  subscriptions: Subscription[]
  picked: Set<string>
  pickable: (item: Subscription) => boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  pick: [item: Subscription]
  leave: []
}>()

const advisor = useAiNewsletters()

const rows = computed(() => advisor.advice.value
  .map(advice => ({ advice, item: props.subscriptions.find(entry => entry.address === advice.address) }))
  .filter((row): row is { advice: AiNewsletterAdvice, item: Subscription } => !!row.item && props.pickable(row.item)))
const pickedHere = computed(() => rows.value.filter(row => props.picked.has(row.item.address)).length)
const checkedOn = computed(() => advisor.last.value.at ? new Date(advisor.last.value.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '')

// Opening the page is the moment to look, at most once a week; the list arrives after the page does
// (and the AI's status arrives from the desktop app a moment later still)
watch([() => props.subscriptions.length, advisor.on], ([count, on]) => {
  if (count && on) advisor.maybeRun(props.subscriptions)
}, { immediate: true })
onMounted(() => {
  if (advisor.advice.value.length && !advisor.due.value) advisor.refreshCounts()
})

function unreadText(address: string) {
  const counts = advisor.unreadOf(address)
  if (!counts?.inInbox) return undefined
  return `${counts.unread} of ${counts.inInbox} in your Inbox unread`
}

function pickAllSuggested() {
  const target = pickedHere.value === rows.value.length
  for (const row of rows.value) if (props.picked.has(row.item.address) === target) emit('pick', row.item)
}
</script>

<template>
  <section
    v-if="advisor.on.value"
    class="mb-6"
    aria-labelledby="newsletter-suggestions"
  >
    <header class="flex flex-wrap items-center gap-2 mb-1">
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 text-(--lb-ai)"
        aria-hidden="true"
      />
      <h2
        id="newsletter-suggestions"
        class="text-sm font-semibold text-highlighted"
      >
        Suggestions
      </h2>
      <span
        v-if="checkedOn && advisor.status.value !== 'asking'"
        class="text-xs text-muted"
      >Checked {{ checkedOn }}</span>
      <UButton
        label="Ask again"
        icon="i-lucide-rotate-cw"
        color="neutral"
        variant="ghost"
        size="xs"
        class="ms-auto"
        :loading="advisor.status.value === 'asking'"
        :disabled="!subscriptions.length"
        @click="advisor.run(subscriptions)"
      />
    </header>
    <p class="text-sm text-muted mb-3">
      Lists you might leave, suggested by AI from how often each one writes and how much of its mail in your Inbox is still unread. Unread is only a rough sign of mail you never open.
    </p>

    <div
      v-if="advisor.status.value === 'asking'"
      role="status"
      class="flex flex-col gap-2"
    >
      <div
        class="h-0.5 w-full overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <div class="h-full w-full lb-ai-progress" />
      </div>
      <span class="sr-only">Looking for lists to suggest</span>
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-10 w-full"
      />
    </div>

    <div
      v-else-if="advisor.status.value === 'error'"
      class="flex items-center gap-3 text-sm"
    >
      <span class="text-error">{{ advisor.error.value }}</span>
    </div>

    <p
      v-else-if="!rows.length && advisor.last.value.at"
      class="text-sm text-toned"
    >
      No list stands out: you seem to open what you get.
    </p>

    <template v-else-if="rows.length">
      <TransitionGroup
        name="lb-list"
        tag="ul"
        class="flex flex-col divide-y divide-default rounded-lg bg-(--lb-ai-bg) ring ring-[color-mix(in_oklab,var(--lb-ai)_18%,transparent)]"
      >
        <li
          v-for="row in rows"
          :key="row.item.address"
          class="flex items-start gap-3 px-3 py-2.5"
        >
          <UCheckbox
            :model-value="picked.has(row.item.address)"
            :aria-label="`Select ${row.item.name || row.item.address} to unsubscribe`"
            :disabled="busy"
            class="mt-0.5"
            @update:model-value="emit('pick', row.item)"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-highlighted truncate">
              {{ row.item.name || row.item.address }}
            </p>
            <p class="text-sm text-toned">
              {{ row.advice.reason || 'Suggested to leave' }}
            </p>
            <p class="text-xs text-muted tabular-nums">
              {{ row.item.count }} {{ row.item.count === 1 ? 'message' : 'messages' }}<template v-if="unreadText(row.item.address)">
                · {{ unreadText(row.item.address) }}
              </template>
            </p>
          </div>
          <UTooltip text="Dismiss">
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Dismiss suggestion for ${row.item.name || row.item.address}`"
              @click="advisor.dismiss(row.item.address)"
            />
          </UTooltip>
        </li>
      </TransitionGroup>
      <div class="flex items-center gap-2 mt-2">
        <UButton
          :label="pickedHere === rows.length ? 'Deselect suggested' : 'Select all suggested'"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="pickAllSuggested"
        />
        <UButton
          v-if="picked.size"
          :label="`Unsubscribe from ${picked.size}`"
          icon="i-lucide-mail-x"
          color="neutral"
          variant="soft"
          size="sm"
          class="ms-auto"
          :disabled="busy"
          @click="emit('leave')"
        />
      </div>
    </template>
  </section>
</template>
