<script setup lang="ts">
// Search across every folder: a field, results as they come in from each
// folder, and the highlighted one previewed beside the list
const search = useSearchAll()
const cache = useMessageCache()

const index = ref(0)
watch(search.hits, list => (index.value = Math.min(index.value, Math.max(0, list.length - 1))))
watch(search.input, () => (index.value = 0))
const current = computed(() => search.hits.value[index.value])

// The highlighted result is read ahead without marking it read
const preview = shallowRef<MessageDetail>()
watchDebounced(current, async (hit) => {
  preview.value = undefined
  if (!hit) return
  const entry = await cache.peek(hit.message.folder, hit.message.id).catch(() => undefined)
  if (current.value === hit) preview.value = entry?.message
}, { debounce: 180, immediate: true })

const list = useTemplateRef<HTMLElement>('list')
function move(offset: number) {
  if (!search.hits.value.length) return
  index.value = (index.value + offset + search.hits.value.length) % search.hits.value.length
  nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(-1)
  else if (event.key === 'Enter' && current.value) search.show(current.value)
  else return
  event.preventDefault()
}

const percent = computed(() => search.progress.value.total ? Math.round((search.progress.value.done / search.progress.value.total) * 100) : 0)
const field = useTemplateRef('field')
function useExample(example: string) {
  search.input.value = `${search.input.value.trim()} ${example}`.trim()
  field.value?.inputRef?.focus()
}
</script>

<template>
  <UModal
    v-model:open="search.isOpen.value"
    title="Search every folder"
    description="Type words, or narrow with operators such as from: and has:attachment."
    :ui="{ content: 'sm:max-w-5xl sm:h-[min(44rem,calc(100dvh-5rem))] flex flex-col lb-in-scale', header: 'sr-only', body: 'p-0! flex-1 min-h-0 flex flex-col' }"
  >
    <template #body>
      <div class="shrink-0 relative border-b border-default">
        <UInput
          ref="field"
          v-model="search.input.value"
          icon="i-lucide-search"
          placeholder="Search all your mail"
          aria-label="Search all your mail"
          role="combobox"
          aria-controls="search-all-results"
          :aria-expanded="search.hits.value.length > 0"
          :aria-activedescendant="current ? `search-all-${index}` : undefined"
          autofocus
          variant="none"
          size="xl"
          :ui="{ base: 'h-14 ps-12 pe-28', leading: 'ps-4' }"
          @keydown="onKey"
        >
          <template #trailing>
            <span
              v-if="search.status.value === 'searching'"
              class="text-xs text-muted tabular-nums"
              role="status"
            >{{ search.progress.value.done }} of {{ search.progress.value.total }} folders</span>
            <UButton
              v-else-if="search.input.value"
              icon="i-lucide-x"
              color="neutral"
              variant="link"
              size="xs"
              aria-label="Clear"
              @click="search.input.value = ''"
            />
          </template>
        </UInput>
        <!-- How far through the folders the search is -->
        <div
          class="absolute bottom-0 start-0 h-0.5 bg-primary transition-[width,opacity] duration-(--lb-dur-3)"
          :class="search.status.value === 'searching' ? 'opacity-100' : 'opacity-0'"
          :style="{ width: `${percent}%` }"
        />
      </div>

      <!-- Nothing typed yet: what was searched before, and what can be typed -->
      <div
        v-if="search.status.value === 'idle'"
        class="flex-1 overflow-y-auto p-5 grid sm:grid-cols-2 gap-8 content-start lb-in"
      >
        <section v-if="search.recent.value.length">
          <h2 class="text-xs font-medium text-muted mb-2">
            Recent searches
          </h2>
          <ul class="flex flex-col gap-0.5">
            <li
              v-for="item in search.recent.value"
              :key="item"
              class="group flex items-center"
            >
              <UButton
                :label="item"
                icon="i-lucide-clock"
                color="neutral"
                variant="ghost"
                size="sm"
                class="flex-1 min-w-0 justify-start font-normal"
                :ui="{ label: 'truncate' }"
                @click="search.input.value = item"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                size="xs"
                :aria-label="`Forget ${item}`"
                class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted"
                @click="search.forget(item)"
              />
            </li>
          </ul>
        </section>
        <section>
          <h2 class="text-xs font-medium text-muted mb-2">
            Narrow it down
          </h2>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="item in SEARCH_OPERATORS"
              :key="item.example"
              class="flex items-baseline gap-3 text-sm"
            >
              <button
                type="button"
                class="font-mono text-xs px-1.5 py-0.5 rounded-sm bg-elevated text-highlighted hover:bg-accented transition-colors duration-(--lb-dur-1) lb-focus"
                @click="useExample(item.example)"
              >
                {{ item.example }}
              </button>
              <span class="text-muted">{{ item.meaning }}</span>
            </li>
          </ul>
          <p class="mt-4 text-xs text-muted text-pretty">
            Each folder is asked in turn, so results fill in as they arrive. Trash and Junk are left out unless you name them with in:.
          </p>
        </section>
      </div>

      <AppEmpty
        v-else-if="search.status.value === 'error'"
        illustration="offline"
        title="The search didn’t finish"
        description="The mail server didn’t answer. Check your connection and try again."
        tone="error"
        class="flex-1"
      />

      <AppEmpty
        v-else-if="search.status.value === 'done' && !search.hits.value.length"
        illustration="no-results"
        title="No matches"
        description="Nothing in your folders matches that. Try fewer words, or take an operator out."
        class="flex-1"
      />

      <div
        v-else
        class="flex-1 min-h-0 flex"
      >
        <ul
          id="search-all-results"
          ref="list"
          role="listbox"
          aria-label="Results"
          class="w-full sm:w-[26rem] shrink-0 overflow-y-auto sm:border-e border-default"
        >
          <li
            v-for="n in search.hits.value.length ? 0 : 6"
            :key="`skeleton-${n}`"
            class="flex flex-col gap-2 px-4 py-3 border-b border-default"
            aria-hidden="true"
          >
            <USkeleton class="h-3.5 w-2/5" />
            <USkeleton class="h-3.5 w-4/5" />
          </li>
          <li
            v-for="(hit, at) in search.hits.value"
            :id="`search-all-${at}`"
            :key="messageKey(hit.message)"
            role="option"
            :aria-selected="at === index"
            class="px-4 py-2.5 border-b border-default cursor-pointer transition-colors duration-(--lb-dur-1)"
            :class="at === index ? 'bg-(--lb-selected) shadow-[inset_2px_0_0_var(--lb-selected-edge)]' : 'hover:bg-elevated/60'"
            @mousemove="index = at"
            @click="search.show(hit)"
          >
            <span class="flex items-baseline gap-2">
              <span
                class="flex-1 truncate text-sm text-highlighted"
                :class="hit.message.unread ? 'font-semibold' : 'font-medium'"
              >{{ hit.folder.role === 'sent' || hit.folder.role === 'drafts' ? `To ${hit.message.to.map(personName).join(', ') || 'no one'}` : personName(hit.message.from) }}</span>
              <span class="shrink-0 text-xs text-muted tabular-nums">{{ listDate(hit.message.date) }}</span>
            </span>
            <span class="block truncate text-sm text-toned">{{ hit.message.subject || '(No subject)' }}</span>
            <span class="flex items-center gap-2 mt-0.5">
              <span class="flex-1 truncate text-xs text-muted">{{ hit.message.preview }}</span>
              <span class="shrink-0 inline-flex items-center gap-1 text-xs text-muted">
                <UIcon
                  :name="folderIcon(hit.folder)"
                  class="size-3"
                />{{ hit.folder.name }}
              </span>
            </span>
          </li>
        </ul>

        <!-- The highlighted result, read ahead -->
        <section
          class="max-sm:hidden flex-1 min-w-0 overflow-y-auto"
          aria-label="Preview"
        >
          <div
            v-if="current"
            :key="messageKey(current.message)"
            class="px-6 py-5 flex flex-col gap-4 lb-in"
          >
            <h2 class="text-lg font-bold tracking-tight text-highlighted text-pretty wrap-anywhere">
              {{ current.message.subject || '(No subject)' }}
            </h2>
            <div class="flex items-center gap-3">
              <SenderAvatar
                :address="current.message.from"
                size="md"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-highlighted truncate">
                  {{ personName(current.message.from) }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ fullDate(current.message.date) }} · {{ current.folder.name }}
                </p>
              </div>
              <UButton
                label="Open"
                size="sm"
                @click="search.show(current)"
              >
                <template #trailing>
                  <UKbd
                    value="enter"
                    size="sm"
                  />
                </template>
              </UButton>
            </div>
            <MailBody
              v-if="preview"
              :message="preview"
              :remote="preview.remoteShown"
            />
            <div
              v-else
              class="flex flex-col gap-2.5"
              aria-hidden="true"
            >
              <USkeleton class="h-3.5 w-full" />
              <USkeleton class="h-3.5 w-11/12" />
              <USkeleton class="h-3.5 w-4/5" />
            </div>
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>
