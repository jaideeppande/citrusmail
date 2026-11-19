<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

// The emoji picker: search, a tab per category and the ones used lately.
// The pick goes where the cursor was, in the message or in the subject.
// Arrow keys move in the grid, Enter puts one in, Escape goes back to writing
const props = defineProps<{
  editor: Editor
}>()

const COLUMNS = 8
const { draft } = useComposer()
const tools = useComposerTools()
const open = tools.emoji
const recent = useLocalPref<string[]>('recent-emoji', [])

const search = ref('')
const tab = ref('recent')
const active = ref(0)
const grid = useTemplateRef('grid')
const searchField = useTemplateRef('searchField')
const byEmoji = new Map(EMOJI.map(item => [item.emoji, item]))

const tabs = computed(() => [
  ...(recent.value.length ? [{ id: 'recent', label: 'Recently used', icon: 'i-lucide-clock' }] : []),
  ...EMOJI_CATEGORIES.map(({ id, label, icon }) => ({ id, label, icon }))
])

const shown = computed<Emoji[]>(() => {
  if (search.value.trim()) return searchEmoji(search.value, 96)
  if (tab.value === 'recent') return recent.value.map(emoji => byEmoji.get(emoji) ?? { emoji, name: emoji, shortcodes: [], tags: [], category: 'recent' })
  return EMOJI_CATEGORIES.find(category => category.id === tab.value)?.items ?? []
})

const heading = computed(() => search.value.trim()
  ? `${shown.value.length} ${shown.value.length === 1 ? 'match' : 'matches'}`
  : tabs.value.find(item => item.id === tab.value)?.label ?? '')

watch(open, (value) => {
  if (!value) return
  search.value = ''
  tab.value = recent.value.length ? 'recent' : 'smileys'
  active.value = 0
})
watch([search, tab], () => (active.value = 0))

function focusCell(index: number) {
  active.value = Math.max(0, Math.min(shown.value.length - 1, index))
  nextTick(() => grid.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)?.focus())
}

function onGridKey(event: KeyboardEvent) {
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUMNS, ArrowDown: COLUMNS }
  if (event.key in moves) {
    const next = active.value + moves[event.key]!
    event.preventDefault()
    // Up from the first row goes back to the search field
    if (next < 0 && event.key === 'ArrowUp') return searchField.value?.inputRef?.focus()
    focusCell(next)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusCell(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusCell(shown.value.length - 1)
  }
}

function onSearchKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' && shown.value.length) {
    event.preventDefault()
    focusCell(0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const first = shown.value[0]
    if (first) pick(first)
  }
}

// Where the cursor goes once the picker closes
function returnFocus() {
  if (tools.lastField.value === 'subject' && tools.subjectInput.value) tools.subjectInput.value.focus()
  else props.editor.commands.focus()
}

function pick(item: Emoji) {
  recent.value = rememberEmoji(recent.value, item.emoji)
  const input = tools.subjectInput.value
  if (tools.lastField.value === 'subject' && input) {
    const start = input.selectionStart ?? draft.value.subject.length
    const end = input.selectionEnd ?? start
    draft.value.subject = `${draft.value.subject.slice(0, start)}${item.emoji}${draft.value.subject.slice(end)}`
    open.value = false
    nextTick(() => {
      input.focus()
      input.setSelectionRange(start + item.emoji.length, start + item.emoji.length)
    })
  } else {
    open.value = false
    nextTick(() => props.editor.chain().focus().insertContent(item.emoji).run())
  }
  announce(`${item.name} inserted`)
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  returnFocus()
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'top', align: 'end', onCloseAutoFocus }"
    :ui="{ content: 'w-[19.5rem] p-0' }"
  >
    <UTooltip text="Emoji">
      <UButton
        icon="i-lucide-smile-plus"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Emoji"
      />
    </UTooltip>

    <template #content>
      <div class="flex flex-col">
        <div class="flex items-center gap-1 border-b border-default ps-3 pe-1.5">
          <UIcon
            name="i-lucide-search"
            class="size-4 shrink-0 text-muted"
          />
          <UInput
            ref="searchField"
            v-model="search"
            autofocus
            variant="none"
            placeholder="Find an emoji"
            aria-label="Find an emoji"
            class="flex-1"
            :ui="{ base: 'px-1.5 h-10 text-sm' }"
            @keydown="onSearchKey"
          />
        </div>

        <div
          v-if="!search.trim()"
          role="tablist"
          aria-label="Emoji categories"
          class="flex items-center justify-between border-b border-default px-1.5 py-1"
        >
          <UTooltip
            v-for="item in tabs"
            :key="item.id"
            :text="item.label"
          >
            <UButton
              role="tab"
              :icon="item.icon"
              color="neutral"
              :variant="tab === item.id ? 'soft' : 'ghost'"
              size="xs"
              :aria-label="item.label"
              :aria-selected="tab === item.id"
              :class="tab === item.id ? 'text-highlighted' : 'text-muted'"
              @click="tab = item.id"
            />
          </UTooltip>
        </div>

        <p
          id="lb-emoji-heading"
          class="px-3 pt-2 pb-1 text-xs font-medium text-muted"
          aria-live="polite"
        >
          {{ heading }}
        </p>
        <div
          v-if="shown.length"
          ref="grid"
          role="listbox"
          aria-labelledby="lb-emoji-heading"
          aria-orientation="horizontal"
          class="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto px-2 pb-2"
          @keydown="onGridKey"
        >
          <button
            v-for="(item, index) in shown"
            :key="`${item.emoji}-${index}`"
            type="button"
            role="option"
            :data-index="index"
            :tabindex="index === active ? 0 : -1"
            :aria-selected="index === active"
            :aria-label="item.name"
            :title="`:${item.shortcodes[0] ?? item.name}:`"
            class="lb-focus grid size-9 place-items-center rounded-md text-xl leading-none transition-colors duration-(--lb-dur-1) hover:bg-elevated aria-selected:bg-elevated"
            @focus="active = index"
            @click="pick(item)"
            @keydown.enter.prevent="pick(item)"
          >
            {{ item.emoji }}
          </button>
        </div>
        <p
          v-else
          class="px-4 py-6 text-center text-sm text-muted"
        >
          No emoji matches “{{ search.trim() }}”.
        </p>
        <p class="border-t border-default px-3 py-1.5 text-xs text-muted">
          Tip: type <kbd class="font-mono">:</kbd> and a name in the message
        </p>
      </div>
    </template>
  </UPopover>
</template>
