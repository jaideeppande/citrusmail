<script setup lang="ts">
// One message being written: the fields and the editor under a small title
// bar. It floats over the app from the dock, or fills a window of its own.
// Distraction-free writing turns the same panel into a quiet full-window
// page: only the subject and the words, the rest a hover or Tab away
const props = defineProps<{
  /** Fills its window (pages/compose.vue): nothing to minimise to */
  standalone?: boolean
}>()

const { draft, version, editor, focusBody, close, minimise, popOut } = useComposer()
const { ready } = useAi()
const { account } = useShell()
const { kbds } = useShortcutKeys()
const tools = useComposerTools()

const subject = useTemplateRef('subject')
watchEffect(() => {
  tools.subjectInput.value = subject.value?.inputRef ?? undefined
})

const title = computed(() => {
  if (draft.value.inReplyTo) return 'Reply'
  if (/^fwd:/i.test(draft.value.subject)) return 'Forward'
  return draft.value.savedAs ? 'Draft' : 'New message'
})

// The editor comes after the signature and attachments in the page, so Tab
// from the subject goes straight to it instead of through them
function onSubjectKey(event: KeyboardEvent) {
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  focusBody()
}

// An emoji goes back to whichever of the two had the cursor last
function onFocusIn(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target === tools.subjectInput.value) tools.lastField.value = 'subject'
  else if (target.closest('.ProseMirror')) tools.lastField.value = 'body'
}

/* Distraction-free writing */
const zen = tools.zen
// Kept a moment after zen ends, so the page can fade back into the panel
const zenShown = ref(zen.value)
const zenLeaving = ref(false)
let leaveTimer: ReturnType<typeof setTimeout> | undefined
watch(zen, (value) => {
  clearTimeout(leaveTimer)
  if (value) {
    zenShown.value = true
    zenLeaving.value = false
    announce('Distraction-free writing. Escape to leave.')
    nextTick(() => editor.value?.commands.focus())
  } else if (zenShown.value) {
    zenLeaving.value = true
    leaveTimer = setTimeout(() => {
      zenShown.value = false
      zenLeaving.value = false
    }, 180)
    announce('Back to the composer')
  }
})
// The mode belongs to the panel on screen: one opened later starts plain
onBeforeUnmount(() => {
  clearTimeout(leaveTimer)
  zen.value = false
})

const plain = computed(() => draft.value.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, 'x'))
const words = computed(() => plain.value.split(/\s+/).filter(word => /\w/.test(word)).length)
const minutes = computed(() => Math.max(1, Math.round(words.value / 230)))
// Drafts are kept on this computer as they are typed: "Saved" once the typing pauses
const saving = ref(false)
const settle = useDebounceFn(() => (saving.value = false), 700)
watch(() => [draft.value.html, draft.value.subject], () => {
  saving.value = true
  settle()
})

// Escape leaves distraction-free writing first, then tucks the message
// away; nothing is closed or lost. An open menu or suggestion list takes the key first
function onEscape(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  if (document.querySelector('[data-reka-popper-content-wrapper]:has([role="menu"], [role="listbox"], [role="dialog"])')) return
  if (zen.value) {
    event.preventDefault()
    zen.value = false
    return
  }
  if (!props.standalone) minimise()
}

defineAppShortcuts({
  'compose.zen': { usingInput: true, handler: () => (zen.value = !zen.value) },
  'compose.emoji': {
    usingInput: true,
    handler: () => {
      if (document.activeElement === tools.subjectInput.value) tools.lastField.value = 'subject'
      tools.emoji.value = true
    }
  }
})
</script>

<template>
  <section
    data-composer
    :aria-label="zenShown ? `${title}, distraction-free` : title"
    class="flex min-h-0 flex-col bg-default"
    :class="[standalone ? 'min-w-0 flex-1' : 'lb-dock-panel', zenShown && 'lb-zen']"
    :data-leaving="zenLeaving || undefined"
    @keydown.esc="onEscape"
    @focusin="onFocusIn"
  >
    <div
      data-zen-edge="top"
      class="shrink-0"
    >
      <header class="flex h-10 shrink-0 items-center gap-0.5 border-b border-default ps-5 pe-1.5">
        <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
          {{ title }}
        </h2>
        <UTooltip
          :text="zen ? 'Leave distraction-free writing' : 'Distraction-free writing'"
          :kbds="kbds('compose.zen')"
        >
          <UButton
            :icon="zen ? 'i-lucide-shrink' : 'i-lucide-expand'"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="zen ? 'Leave distraction-free writing' : 'Distraction-free writing'"
            :aria-pressed="zen"
            @click="zen = !zen"
          />
        </UTooltip>
        <template v-if="!standalone && !zen">
          <UTooltip
            text="Minimise"
            :kbds="['esc']"
          >
            <UButton
              icon="i-lucide-minus"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Minimise"
              @click="minimise()"
            />
          </UTooltip>
          <UTooltip text="Open in its own window">
            <UButton
              icon="i-lucide-picture-in-picture-2"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Open in its own window"
              @click="popOut()"
            />
          </UTooltip>
        </template>
        <UTooltip text="Save and close">
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Save and close"
            @click="close()"
          />
        </UTooltip>
      </header>

      <MailComposerField
        label="From"
        class="lb-compact-hide"
      >
        <span class="truncate text-sm text-toned">
          {{ account?.name ? `${account.name} <${account.email}>` : account?.email }}
        </span>
      </MailComposerField>

      <MailComposerRecipients />
    </div>

    <MailComposerField
      label="Subject"
      class="lb-zen-subject"
    >
      <UInput
        ref="subject"
        v-model="draft.subject"
        aria-label="Subject"
        variant="none"
        :placeholder="zenShown ? 'Subject' : undefined"
        :autofocus="!!draft.to.length && !draft.subject"
        :ui="{ base: 'px-0 h-10 text-[15px] font-semibold text-highlighted' }"
        @keydown="onSubjectKey"
      />
    </MailComposerField>

    <template v-if="!zenShown">
      <MailComposerAi v-if="ready && draft.replyingTo" />
      <MailComposerTranslate v-if="ready && draft.translateTo" />
    </template>

    <MailComposerBody
      :key="version"
      class="min-h-0 flex-1"
    />

    <footer
      v-if="zenShown"
      class="lb-zen-status flex shrink-0 items-center justify-center gap-3 py-2 text-xs text-muted tabular-nums"
    >
      <span>{{ words }} {{ words === 1 ? 'word' : 'words' }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ minutes }} min read</span>
      <span aria-hidden="true">·</span>
      <span
        role="status"
        :title="saving ? undefined : 'Kept on this computer as you type'"
      >{{ saving ? 'Saving…' : 'Saved' }}</span>
      <span aria-hidden="true">·</span>
      <span>
        <UKbd value="esc" /> to leave
      </span>
    </footer>
  </section>
</template>
