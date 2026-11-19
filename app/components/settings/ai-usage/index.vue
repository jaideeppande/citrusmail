<script setup lang="ts">
// What AI has used: requests and tokens per feature today and over the last
// 30 days, as the provider counted them (or estimated where it doesn't say),
// and the daily limit on what runs without being asked
const ai = useAiClient()
const usage = ref<DesktopAiUsage>()
const limit = ref(0)

async function load() {
  usage.value = await ai.bridge?.usage().catch(() => undefined)
  if (usage.value) limit.value = usage.value.limit
}
onMounted(load)
useIntervalFn(load, 30_000)

const saveLimit = useDebounceFn(async () => {
  usage.value = await ai.bridge?.setLimit(limit.value).catch(() => usage.value)
  announce(`Daily limit set to ${limit.value}`)
}, 600)

const today = new Date().toISOString().slice(0, 10)
const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10)

const rows = computed(() => {
  const days = usage.value?.days ?? {}
  const sum = new Map<string, { today: number, month: number, tokens: number }>()
  for (const [day, features] of Object.entries(days)) {
    if (day < since) continue
    for (const [feature, entry] of Object.entries(features)) {
      const row = sum.get(feature) ?? { today: 0, month: 0, tokens: 0 }
      row.month += entry.requests
      row.tokens += entry.input + entry.output
      if (day === today) row.today += entry.requests
      sum.set(feature, row)
    }
  }
  return [...sum].map(([feature, row]) => ({ feature, label: AI_FEATURES.find(item => item.id === feature)?.label ?? feature, ...row })).sort((a, b) => b.month - a.month)
})
const totals = computed(() => rows.value.reduce((all, row) => ({ today: all.today + row.today, month: all.month + row.month, tokens: all.tokens + row.tokens }), { today: 0, month: 0, tokens: 0 }))
const share = computed(() => usage.value && usage.value.limit ? Math.min(100, Math.round((usage.value.backgroundToday / usage.value.limit) * 100)) : 0)
const format = (count: number) => count >= 10_000 ? `${Math.round(count / 1000)}k` : count.toLocaleString()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <UFormField
        label="Daily limit for AI running on its own"
        description="Priority tags, scam checks, suggested labels, the briefing, autocomplete and the like stop for the day once this many requests have been made. What you ask for yourself is never limited."
      >
        <div class="flex items-center gap-3 mt-1">
          <UInputNumber
            v-model="limit"
            :min="0"
            :max="100000"
            :step="50"
            aria-label="Daily limit"
            class="w-36"
            @update:model-value="saveLimit"
          />
          <span class="text-sm text-muted tabular-nums">{{ usage?.backgroundToday ?? 0 }} used today</span>
        </div>
      </UFormField>
      <UProgress
        :model-value="share"
        size="xs"
        :aria-label="`${share}% of today's limit used`"
        class="max-w-sm"
      />
    </div>

    <div>
      <h3 class="text-xs font-medium text-muted mb-1.5">
        Use, as counted on this computer
      </h3>
      <p
        v-if="!rows.length"
        class="text-sm text-muted"
      >
        Nothing yet.
      </p>
      <table
        v-else
        class="w-full text-sm"
      >
        <caption class="sr-only">
          AI requests per feature, today and in the last 30 days
        </caption>
        <thead>
          <tr class="text-xs text-muted text-start border-b border-default">
            <th
              scope="col"
              class="py-1.5 font-medium text-start"
            >
              Feature
            </th>
            <th
              scope="col"
              class="py-1.5 font-medium text-end"
            >
              Today
            </th>
            <th
              scope="col"
              class="py-1.5 font-medium text-end"
            >
              30 days
            </th>
            <th
              scope="col"
              class="py-1.5 font-medium text-end"
            >
              Tokens, 30 days
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="row in rows"
            :key="row.feature"
          >
            <th
              scope="row"
              class="py-1.5 font-normal text-start text-default"
            >
              {{ row.label }}
            </th>
            <td class="py-1.5 text-end tabular-nums">
              {{ row.today }}
            </td>
            <td class="py-1.5 text-end tabular-nums">
              {{ row.month }}
            </td>
            <td class="py-1.5 text-end tabular-nums text-muted">
              {{ format(row.tokens) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-default font-medium">
            <th
              scope="row"
              class="py-1.5 text-start"
            >
              Total
            </th>
            <td class="py-1.5 text-end tabular-nums">
              {{ totals.today }}
            </td>
            <td class="py-1.5 text-end tabular-nums">
              {{ totals.month }}
            </td>
            <td class="py-1.5 text-end tabular-nums text-muted">
              {{ format(totals.tokens) }}
            </td>
          </tr>
        </tfoot>
      </table>
      <p class="mt-2 text-xs text-muted text-pretty">
        Your provider bills by token. Their dashboard has the exact figures; these are what this computer saw.
      </p>
    </div>
  </div>
</template>
