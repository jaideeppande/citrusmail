<script setup lang="ts">
import type { CommandPaletteItem } from '@nuxt/ui'

// The dock: every open draft as a tab along the bottom of the window, and
// the one being written as a panel above them. Nothing behind it is blocked,
// so mail can be read (and copied from) while writing
const { open, draft, drafts, activeId, hasDraft, standalone, closed, activate, minimise, close, compose, reopenClosed } = useComposer()
const { templates, insert } = useTemplates()
const { templates: templatesOpen } = useComposerTools()
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

/** "Ana, Ben · 5 minutes ago" under a closed draft's subject */
function closedLine(entry: ClosedDraft) {
  const people = [...entry.draft.to, ...entry.draft.cc].map(personName).join(', ')
  const minutes = Math.round((Date.now() - entry.closedAt) / 60_000)
  const when = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : listDate(new Date(entry.closedAt).toISOString())
  return [people, when].filter(Boolean).join(' · ')
}

function pickTemplate() {
  if (!open.value || !hasDraft.value) {
    const waiting = hasDraft.value ? draft.value : drafts.value.at(-1)
    if (waiting) activate(waiting.id)
    else compose()
  }
  // Once the panel is there for the list to hang from
  setTimeout(() => (templatesOpen.value = true), 320)
}

// "New message" is among the app's own commands (useAppCommands); these are
// the composer's. A pane leaves them to the window it sits in
if (docked) {
  useCommands(() => {
    const items: CommandPaletteItem[] = [
      templates.value.length
        ? { label: 'Insert template…', icon: 'i-lucide-file-text', children: templates.value.map(template => ({ label: template.name, suffix: template.subject, icon: 'i-lucide-file-text', onSelect: () => insert(template) })) }
        : { label: 'Insert template…', icon: 'i-lucide-file-text', onSelect: pickTemplate }
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
      />
    </Transition>

    <TransitionGroup
      name="lb-pop"
      tag="ul"
      class="lb-dock-tabs pointer-events-auto flex max-w-full items-end justify-end gap-1.5 overflow-x-auto px-1 pt-1"
      aria-label="Open drafts"
    >
      <li
        v-for="item in drafts"
        :key="item.id"
        class="lb-dock-tab group/tab"
        :data-active="open && item.id === activeId"
      >
        <button
          type="button"
          class="lb-focus flex h-9 min-w-0 flex-1 items-center gap-2 rounded-tl-lg ps-3 pe-1 text-sm"
          :aria-expanded="open && item.id === activeId"
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
            :aria-label="`Close ${draftTitle(item)}`"
            class="me-1 shrink-0"
            @click="close(item.id)"
          />
        </UTooltip>
      </li>
    </TransitionGroup>
  </div>
</template>
