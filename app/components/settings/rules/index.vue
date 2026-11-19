<script setup lang="ts">
const brand = useBrand()
const route = useRoute()
const router = useRouter()
const { rules, status, edit, toggle, remove } = useRules()
const ai = useAiClient()
const aiRules = useAiRules()

/* Describe a rule ---------------------------------------------------- */

// The AI fills in the usual editor; the person checks it and adds it there
const description = ref('')
async function describe() {
  if (aiRules.status.value === 'thinking') return
  const made = await aiRules.draft(description.value)
  if (!made) return
  announce('Rule filled in. Check it, then add it')
  await edit(undefined, undefined, made)
  description.value = ''
}

// "Filter mail into this folder" from a folder's menu lands here
onMounted(() => {
  const folder = route.query.folder as string | undefined
  if (!folder) return
  router.replace({ query: {} })
  edit(undefined, folder)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Only in the desktop app, where AI runs: quiet until a key is added -->
    <form
      v-if="ai.bridge"
      class="flex flex-col gap-2"
      @submit.prevent="describe"
    >
      <label
        for="rule-description"
        class="flex items-center gap-1.5 text-sm font-medium text-highlighted"
      >
        <UIcon
          name="i-lucide-sparkles"
          class="size-4 text-(--lb-ai)"
        />
        Describe a rule
      </label>
      <div class="flex gap-2">
        <UInput
          id="rule-description"
          v-model="description"
          placeholder="Move receipts from shops to Receipts and mark them read"
          :disabled="!aiRules.available.value"
          aria-describedby="rule-description-hint"
          class="min-w-0 flex-1"
        />
        <UButton
          type="submit"
          label="Fill in rule"
          color="neutral"
          variant="outline"
          :loading="aiRules.status.value === 'thinking'"
          :disabled="!aiRules.available.value || !description.trim()"
        />
      </div>
      <p
        id="rule-description-hint"
        class="text-xs"
        :class="aiRules.status.value === 'error' ? 'text-error' : 'text-muted'"
        :role="aiRules.status.value === 'error' ? 'alert' : undefined"
      >
        <template v-if="aiRules.status.value === 'error'">
          {{ aiRules.error.value }}
        </template>
        <template v-else-if="!aiRules.available.value">
          {{ ai.available.value ? 'Rules in plain English is switched off in Settings → AI.' : 'Add an AI key in Settings → AI to describe rules in your own words.' }}
        </template>
        <template v-else>
          The rule opens for you to check. Nothing is saved until you add it.
        </template>
      </p>
    </form>

    <USkeleton
      v-if="status === 'pending' && !rules.length"
      class="h-32"
    />

    <AppEmpty
      v-else-if="!rules.length"
      illustration="empty-folder"
      title="No rules yet"
      description="A rule moves mail out of your Inbox as it arrives, like receipts into a Receipts folder."
      :actions="[{ label: 'New rule', icon: 'i-lucide-plus', onClick: () => edit() }]"
      variant="outline"
    />

    <template v-else>
      <ul class="rounded-lg ring ring-default divide-y divide-default">
        <SettingsRuleRow
          v-for="rule in rules"
          :key="rule.id"
          :rule="rule"
          @edit="edit(rule)"
          @toggle="toggle(rule, $event)"
          @remove="remove(rule)"
        />
      </ul>
      <UButton
        label="New rule"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="edit()"
      />
    </template>

    <p class="text-xs text-muted">
      Rules run on your Inbox each time {{ brand.name }} checks for mail, on any device where it’s open.
    </p>
  </div>
</template>
