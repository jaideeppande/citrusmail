<script setup lang="ts">
import type { CommandPaletteItem, DropdownMenuItem } from '@nuxt/ui'

// The dock: every open draft as a tab along the bottom of the window, and
// the one being written as a panel above them. Nothing behind it is blocked,
// so mail can be read (and copied from) while writing
const { open, draft, drafts, activeId, hasDraft, standalone, closed, editor, activate, minimise, close, compose, reopenClosed } = useComposer()
const { templates, insert } = useTemplates()
const tools = useComposerTools()
const { toasts } = useToast()
const { width } = useWindowSize()
const { kbds } = useShortcutKeys()
// A pane of a split layout has no dock of its own: what it starts shows in
// the dock of the window it sits in
const docked = windowKind() !== 'pane'

function toggle(id: string) {
  if (open.value && activeId.value === id) minimise()
  else activate(id)
}

function tabIcon(item: Draft) {
  if (item.inReplyTo) return 'i-lucide-reply'
  if (item.quote) return 'i-lucide-forward'
  return 'i-lucide-pen-line'
}

/* Tabs that don't fit go in a "+3" menu; the one on screen always shows */
const TAB_WIDTH = 168
const capacity = computed(() => Math.max(1, Math.floor((width.value - 96) / TAB_WIDTH)))
const visible = computed(() => {
  if (drafts.value.length <= capacity.value) return drafts.value
  const shown = drafts.value.slice(-(capacity.value - 1 || 1))
  const current = drafts.value.find(item => item.id === activeId.value)
  if (current && !shown.includes(current)) shown.splice(0, 1, current)
  return drafts.value.filter(item => shown.includes(item))
})
const hidden = computed(() => drafts.value.filter(item => !visible.value.includes(item)))
const hiddenItems = computed<DropdownMenuItem[]>(() => hidden.value.map(item => ({ label: draftTitle(item), icon: tabIcon(item), onSelect: () => activate(item.id) })))

const strip = useTemplateRef('strip')
useRovingFocus(strip)

/* Focus: into the message when it opens, back where it was when it's tucked away */
let returnTo: HTMLElement | undefined
watch(open, (value, before) => {
  if (value && !before) {
    const active = document.activeElement as HTMLElement | null
    returnTo = active && !active.closest('[data-composer]') && active !== document.body ? active : undefined
    return
  }
  if (value || !before || !hasDraft.value) return
  // Minimised (the draft is still here): to what had the cursor, or its tab
  nextTick(() => {
    const target = returnTo?.isConnected ? returnTo : strip.value?.querySelector<HTMLElement>(`[data-draft="${activeId.value}"]`)
    target?.focus()
    returnTo = undefined
  })
})

// The app's notices sit at the bottom centre, about 25rem wide: while one
// shows over where the panel's footer is, the panel steps up out of its way
const PANEL = 736
const TOAST_HALF = 210
const lifted = computed(() => toasts.value.length > 0 && width.value - 16 - Math.min(PANEL, width.value - 32) < width.value / 2 + TOAST_HALF)

/** "Ana, Ben · 5 minutes ago" under a closed draft's subject */
function closedLine(entry: ClosedDraft) {
  const people = [...entry.draft.to, ...entry.draft.cc].map(personName).join(', ')
  const minutes = Math.round((Date.now() - entry.closedAt) / 60_000)
  const when = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : listDate(new Date(entry.closedAt).toISOString())
  return [people, when].filter(Boolean).join(' · ')
}

/** Makes sure a draft is on screen, then runs `then` once its panel is there */
function withDraft(then: () => void) {
  if (!open.value || !hasDraft.value) {
    const waiting = hasDraft.value ? draft.value : drafts.value.at(-1)
    if (waiting) activate(waiting.id)
    else compose()
  }
  // Once the panel is there for a pop-up to hang from
  setTimeout(then, 320)
}

function pickTemplate() {
  withDraft(() => (tools.templates.value = true))
}

// "New message" is among the app's own commands (useAppCommands); these are
// the composer's. A pane leaves them to the window it sits in
if (docked) {
  useCommands(() => {
    const items: CommandPaletteItem[] = [
      templates.value.length
        ? { label: 'Insert template…', icon: 'i-lucide-file-text', children: templates.value.map(template => ({ label: template.name, suffix: template.subject, icon: 'i-lucide-file-text', onSelect: () => insert(template) })) }
        : { label: 'Insert template…', icon: 'i-lucide-file-text', onSelect: pickTemplate },
      { label: 'Distraction-free writing', icon: 'i-lucide-expand', kbds: kbds('compose.zen'), onSelect: () => withDraft(() => (tools.zen.value = true)) },
      {
        label: 'Insert emoji',
        icon: 'i-lucide-smile-plus',
        kbds: kbds('compose.emoji'),
        onSelect: () => withDraft(() => {
          tools.lastField.value = 'body'
          tools.emoji.value = true
        })
      },
      { label: 'Insert table', icon: 'i-lucide-table', onSelect: () => withDraft(() => editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()) },
      { label: 'Manage signatures…', icon: 'i-lucide-signature', onSelect: () => (tools.manageSignatures.value = true) }
    ]
    if (closed.value.length) {
      items.push({
        label: 'Recently closed drafts',
        icon: 'i-lucide-rotate-ccw-clock',
        children: closed.value.map(entry => ({ label: draftTitle(entry.draft), suffix: closedLine(entry), icon: 'i-lucide-file-pen-line', onSelect: () => reopenClosed(entry.id) }))
      })
    }
    return [{ id: 'composer', label: 'Write', items }]
  })
}
</script>

<template>
  <div
    v-if="docked && !standalone"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-end gap-2 px-4 max-sm:px-0"
  >
    <Transition
      name="lb-rise"
      mode="out-in"
    >
      <MailComposerPanel
        v-if="open && hasDraft"
        :key="draft.id"
        class="pointer-events-auto"
        :data-lifted="lifted || undefined"
      />
    </Transition>

    <div
      ref="strip"
      role="toolbar"
      aria-label="Open drafts"
      class="pointer-events-auto flex max-w-full items-end justify-end gap-1.5 px-1 pt-1"
    >
      <TransitionGroup
        name="lb-pop"
        tag="div"
        class="lb-dock-tabs flex min-w-0 items-end justify-end gap-1.5"
      >
        <div
          v-for="item in visible"
          :key="item.id"
          class="lb-dock-tab group/tab"
          :data-active="open && item.id === activeId"
        >
          <button
            type="button"
            class="lb-focus flex h-8 min-w-0 flex-1 items-center gap-2 rounded-tl-lg ps-3 pe-1 text-[13px]"
            :data-draft="item.id"
            :aria-expanded="open && item.id === activeId"
            :aria-label="`${draftTitle(item)}${open && item.id === activeId ? '' : ', minimised'}`"
            :title="draftTitle(item)"
            @click="toggle(item.id)"
          >
            <UIcon
              :name="tabIcon(item)"
              class="size-3.5 shrink-0 text-muted"
            />
            <span class="truncate font-medium text-highlighted">{{ draftTitle(item) }}</span>
          </button>
          <UTooltip text="Save and close">
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Save and close ${draftTitle(item)}`"
              class="me-1 shrink-0"
              @click="close(item.id)"
            />
          </UTooltip>
        </div>
      </TransitionGroup>
      <UDropdownMenu
        v-if="hidden.length"
        :items="hiddenItems"
        :content="{ side: 'top', align: 'end' }"
        :ui="{ content: 'min-w-56' }"
      >
        <UButton
          :label="`+${hidden.length}`"
          color="neutral"
          variant="outline"
          size="sm"
          :aria-label="`${hidden.length} more ${hidden.length === 1 ? 'draft' : 'drafts'}`"
          class="lb-dock-more mb-0 h-8 rounded-b-none bg-default"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
