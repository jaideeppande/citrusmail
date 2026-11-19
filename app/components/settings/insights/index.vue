<script setup lang="ts">
// Settings → Insights: your mail in numbers. Counted on this computer from
// the Inbox and Sent lists; nothing is sent anywhere to work it out
const { snapshot, loading, failed, load } = useInsights()
const { folders } = useMail()
const { account } = useShell()

onMounted(() => load())
// The numbers are a mailbox's own
watch(() => account.value?.email, () => load())

const unread = computed(() => folders.value.find(folder => folder.role === 'inbox')?.unread ?? 0)
const data = computed(() => snapshot.value?.insights)
const empty = computed(() => !!snapshot.value && !snapshot.value.inbox && !snapshot.value.sent)

const count = (value: number, one: string) => `${value.toLocaleString()} ${value === 1 ? one : `${one}s`}`

/** What the numbers stand on, said plainly */
const basis = computed(() => {
  const shot = snapshot.value
  if (!shot) return ''
  const sent = shot.noSent ? '' : ` and the last ${count(shot.sent, 'message')} in Sent`
  const at = new Date(shot.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Based on the last ${count(shot.inbox, 'message')} in Inbox${sent}, counted on this computer at ${at}.`
})

/** The lists were long enough that the 30 days aren't all there */
const partial = computed(() => {
  const since = snapshot.value?.since
  if (!since || Date.now() - since.getTime() > 30 * 86_400_000) return ''
  return `Only mail since ${since.toLocaleDateString([], { day: 'numeric', month: 'long' })} was read, so days before it and the 30-day totals are incomplete.`
})

const response = computed(() => data.value?.responseMs === undefined
  ? { value: '–', note: 'No answers to go on yet' }
  : { value: formatDuration(data.value.responseMs), note: `Median over ${count(data.value.responses, 'answer')}` })
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex items-start gap-3">
      <p class="min-w-0 flex-1 text-sm text-muted">
        <template v-if="basis">
          {{ basis }}
        </template>
        <template v-else-if="failed">
          Your mail couldn’t be read just now.
        </template>
        <template v-else>
          Reading your Inbox and Sent…
        </template>
      </p>
      <UButton
        :label="failed && !snapshot ? 'Try again' : 'Refresh'"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="loading"
        @click="load(true)"
      />
    </div>

    <p
      v-if="partial"
      class="flex items-start gap-2 rounded-md bg-elevated px-3 py-2.5 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-info"
        class="mt-0.5 size-4 shrink-0"
      />
      {{ partial }}
    </p>
    <p
      v-if="failed && snapshot"
      class="text-sm text-warning"
      role="alert"
    >
      Couldn’t refresh just now. These are the numbers from before.
    </p>

    <div
      v-if="!data && loading"
      class="flex flex-col gap-8"
      aria-hidden="true"
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <USkeleton
          v-for="n in 6"
          :key="n"
          class="h-22"
        />
      </div>
      <USkeleton class="h-44" />
      <USkeleton class="h-32" />
    </div>

    <AppEmpty
      v-else-if="empty"
      illustration="no-results"
      title="Nothing to count yet"
      description="Once there’s mail in your Inbox and Sent, this page shows how much, when, and from whom."
    />

    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SettingsInsightsTile
          label="Received, last 7 days"
          :value="data.received7"
          class="lb-stagger"
          :style="{ '--lb-i': 0 }"
        />
        <SettingsInsightsTile
          label="Sent, last 7 days"
          :value="data.sent7"
          class="lb-stagger"
          :style="{ '--lb-i': 1 }"
        />
        <SettingsInsightsTile
          label="Unread in Inbox now"
          :value="unread"
          class="lb-stagger"
          :style="{ '--lb-i': 2 }"
        />
        <SettingsInsightsTile
          label="Received, last 30 days"
          :value="data.received30"
          class="lb-stagger"
          :style="{ '--lb-i': 3 }"
        />
        <SettingsInsightsTile
          label="Sent, last 30 days"
          :value="data.sent30"
          class="lb-stagger"
          :style="{ '--lb-i': 4 }"
        />
        <SettingsInsightsTile
          label="Time to your first answer"
          :value="response.value"
          :note="response.note"
          class="lb-stagger"
          :style="{ '--lb-i': 5 }"
        />
      </div>

      <!-- Keyed by when it was counted, so a refresh grows the bars in again -->
      <SettingsInsightsDays
        :key="`days-${snapshot!.at}`"
        :days="data.days"
      />
      <SettingsInsightsHours
        :key="`hours-${snapshot!.at}`"
        :hours="data.hours"
      />
      <SettingsInsightsSenders
        :key="`senders-${snapshot!.at}`"
        :senders="data.senders"
      />
    </template>
  </div>
</template>
