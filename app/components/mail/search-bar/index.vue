<script setup lang="ts">
// Search this folder as you type, or (with an AI key) ask a question of all
// your mail and press Enter
const { folder, search, status, filtering, filter, filters, ai, askAi, exitAi } = useMail()
const { ready } = useAi()
const { kbds } = useShortcutKeys()

// A search worth keeping goes in the sidebar under a name
const searches = useSavedSearches()
const saveOpen = ref(false)
const saveName = ref('')
watch(saveOpen, (open) => {
  if (open) saveName.value = search.value.trim() || searches.describe({ search: '', filter: filter.value, filters: filters.value })
})
function saveSearch() {
  searches.save(saveName.value)
  saveOpen.value = false
}

const searchInput = useTemplateRef('searchInput')
const question = ref('')
const asking = computed(() => ai.value.on)

const model = computed({
  get: () => asking.value ? question.value : search.value,
  set: (value: string) => {
    if (asking.value) question.value = value
    else search.value = value
  }
})

function toggleAi() {
  if (asking.value) {
    exitAi()
  } else {
    // What was typed carries over as the question
    question.value = search.value
    search.value = ''
    ai.value = { on: true, status: 'idle', query: '' }
  }
  nextTick(() => searchInput.value?.inputRef?.focus())
}

function onEnter() {
  if (asking.value) askAi(question.value)
}

function onEscape(event: KeyboardEvent) {
  if (asking.value) exitAi()
  else search.value = ''
  ;(event.target as HTMLInputElement).blur()
}

defineAppShortcuts({ 'mail.search': () => searchInput.value?.inputRef?.focus() })
</script>

<template>
  <div
    class="shrink-0 border-b border-default transition-colors"
    :class="asking && 'bg-(--lb-ai-bg)'"
  >
    <UInput
      ref="searchInput"
      v-model="model"
      :icon="asking ? 'i-lucide-sparkles' : 'i-lucide-search'"
      :placeholder="asking ? 'Ask about any message, then press Enter' : `Search ${folder?.name ?? 'mail'}`"
      variant="none"
      size="lg"
      :loading="asking ? ai.status === 'loading' : status === 'loading' && (!!search || filtering)"
      :ui="{ base: 'ps-11 pe-32 h-11', leading: 'ps-4', leadingIcon: asking ? 'text-(--lb-ai)' : '', trailing: 'pe-2 gap-1' }"
      @keydown.enter="onEnter"
      @keydown.escape="onEscape"
    >
      <template #trailing>
        <UButton
          v-if="model"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          aria-label="Clear search"
          @click="model = ''"
        />
        <span
          v-else-if="!asking"
          class="hidden lg:inline-flex items-center gap-0.5"
        >
          <UKbd
            v-for="key in kbds('mail.search')"
            :key="key"
            :value="key"
            variant="soft"
          />
        </span>
        <UPopover
          v-if="searches.canSave.value"
          v-model:open="saveOpen"
          :content="{ align: 'end' }"
          :ui="{ content: 'w-72 p-3' }"
        >
          <UTooltip :text="searches.current.value ? `Saved as “${searches.current.value.name}”` : 'Save this search'">
            <UButton
              :icon="searches.current.value ? 'i-ph-bookmark-simple-fill' : 'i-lucide-bookmark'"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Save this search"
              :ui="{ leadingIcon: searches.current.value ? 'text-primary lb-mark-pop' : '' }"
            />
          </UTooltip>
          <template #content>
            <form
              class="flex flex-col gap-2"
              @submit.prevent="saveSearch"
            >
              <label
                for="save-search-name"
                class="text-xs font-medium text-muted"
              >Keep this search in the sidebar as</label>
              <div class="flex items-center gap-1.5">
                <UInput
                  id="save-search-name"
                  v-model="saveName"
                  size="sm"
                  maxlength="60"
                  autofocus
                  class="flex-1"
                />
                <UButton
                  type="submit"
                  label="Save"
                  size="sm"
                  :disabled="!saveName.trim()"
                />
              </div>
            </form>
          </template>
        </UPopover>
        <UTooltip
          v-if="ready"
          :text="asking ? 'Back to searching this folder' : 'Ask AI about all your mail'"
        >
          <UButton
            icon="i-lucide-sparkles"
            :color="asking ? 'primary' : 'neutral'"
            :variant="asking ? 'soft' : 'ghost'"
            size="xs"
            :aria-pressed="asking"
            aria-label="Ask AI about all your mail"
            :class="asking && 'text-(--lb-ai) bg-[color-mix(in_oklab,var(--lb-ai)_14%,transparent)]'"
            @click="toggleAi"
          />
        </UTooltip>
        <MailSearchFilters v-if="!asking" />
      </template>
    </UInput>

    <MailSearchChips v-if="!asking" />
  </div>
</template>
