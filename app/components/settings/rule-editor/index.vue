<script setup lang="ts">
const props = defineProps<{
  rule?: MailRule
  /** A folder to start with, from "Filter mail into this folder" */
  folder?: string
  /** A new rule filled in already (by the AI, from a description), for the person to check */
  draft?: RuleInput
  /** What to say about the draft: what was left out, a folder it makes */
  notes?: string[]
}>()

const emit = defineEmits<{
  close: [rule?: RuleInput]
}>()

const { folders } = useMail()

const start = props.rule ?? props.draft
const state = reactive<RuleInput>({
  id: start?.id ?? crypto.randomUUID(),
  enabled: start?.enabled ?? true,
  match: start?.match ?? 'all',
  conditions: start ? start.conditions.map(condition => ({ ...condition })) : [{ field: 'from', value: '' }],
  folder: start?.folder ?? props.folder ?? '',
  markRead: start?.markRead ?? false,
  createFolder: props.draft?.createFolder ?? false,
  applyToExisting: props.draft?.applyToExisting ?? !props.rule
})

// Any folder but the Inbox itself; typing a new name creates it on save
const folderItems = computed(() => [
  ...folders.value.filter(folder => folder.role !== 'inbox').map(folder => ({ label: folder.name, value: folder.path, icon: folderIcon(folder) })),
  ...(state.createFolder && state.folder ? [{ label: state.folder, value: state.folder, icon: 'i-lucide-folder-plus' }] : [])
])

function createFolder(name: string) {
  state.createFolder = true
  state.folder = name.trim()
}

const MATCH = [{ label: 'all', value: 'all' }, { label: 'any', value: 'any' }]

function validate() {
  if (state.conditions.some(condition => !condition.value.trim())) return [{ name: 'conditions', message: 'Fill in every condition' }]
  if (!state.folder) return [{ name: 'folder', message: 'Choose a folder' }]
  return []
}
</script>

<template>
  <UModal
    :title="rule ? 'Edit rule' : 'New rule'"
    :ui="{ content: 'sm:max-w-xl', footer: 'justify-end gap-2' }"
    @update:open="emit('close')"
  >
    <template #body>
      <div
        v-if="draft"
        class="mb-6 flex gap-2.5 rounded-lg bg-(--lb-ai-bg) px-3 py-2.5 text-sm"
      >
        <UIcon
          name="i-lucide-sparkles"
          class="mt-0.5 size-4 shrink-0 text-(--lb-ai)"
        />
        <div class="flex flex-col gap-1">
          <p class="font-medium text-highlighted">
            Suggested from your description. Check it, then add it.
          </p>
          <p
            v-for="note in notes"
            :key="note"
            class="text-toned"
          >
            {{ note }}
          </p>
        </div>
      </div>
      <UForm
        id="rule-form"
        :state="state"
        :validate="validate"
        class="flex flex-col gap-6"
        @submit="emit('close', { ...state, folder: state.folder })"
      >
        <UFormField name="conditions">
          <template #label>
            <span class="flex items-center gap-2">
              When
              <USelect
                v-if="state.conditions.length > 1"
                v-model="state.match"
                :items="MATCH"
                aria-label="Match all or any of the conditions"
                size="xs"
                class="w-16"
              />
              <template v-else>a message</template>
              <span v-if="state.conditions.length > 1">of these match</span>
            </span>
          </template>
          <div class="flex flex-col gap-2">
            <SettingsRuleCondition
              v-for="(_, index) in state.conditions"
              :key="index"
              v-model="state.conditions[index]!"
              :removable="state.conditions.length > 1"
              @remove="state.conditions.splice(index, 1)"
            />
            <UButton
              label="Add condition"
              icon="i-lucide-plus"
              color="neutral"
              variant="link"
              size="sm"
              class="self-start px-0"
              @click="state.conditions.push({ field: 'from', value: '' })"
            />
          </div>
        </UFormField>

        <UFormField
          label="Move it to"
          name="folder"
        >
          <USelectMenu
            v-model="state.folder"
            :items="folderItems"
            value-key="value"
            create-item="always"
            placeholder="Choose or type a new folder"
            :search-input="{ placeholder: 'Find or name a folder' }"
            @create="createFolder"
          />
        </UFormField>

        <div class="flex flex-col gap-3">
          <UCheckbox
            v-model="state.markRead"
            label="Also mark it as read"
          />
          <UCheckbox
            v-if="!rule"
            v-model="state.applyToExisting"
            label="Move matching mail already in my Inbox"
          />
        </div>
      </UForm>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
      <UButton
        type="submit"
        form="rule-form"
        :label="rule ? 'Save rule' : 'Add rule'"
      />
    </template>
  </UModal>
</template>
