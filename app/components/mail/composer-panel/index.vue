<script setup lang="ts">
// One message being written: the fields and the editor under a small title
// bar. It floats over the app from the dock, or fills a window of its own
const props = defineProps<{
  /** Fills its window (pages/compose.vue): nothing to minimise to */
  standalone?: boolean
}>()

const { draft, version, focusBody, close, minimise, popOut } = useComposer()
const { ready } = useAi()
const { account } = useShell()

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

// Escape tucks the message away; nothing is closed or lost. An open menu or
// suggestion list takes the key first
function onEscape(event: KeyboardEvent) {
  if (props.standalone || event.defaultPrevented) return
  if (document.querySelector('[data-reka-popper-content-wrapper]:has([role="menu"], [role="listbox"], [role="dialog"])')) return
  minimise()
}
</script>

<template>
  <section
    data-composer
    :aria-label="title"
    class="flex min-h-0 flex-col bg-default"
    :class="standalone ? 'min-w-0 flex-1' : 'lb-dock-panel'"
    @keydown.esc="onEscape"
  >
    <header class="flex h-12 shrink-0 items-center gap-1 border-b border-default ps-5 pe-2">
      <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
        {{ title }}
      </h2>
      <template v-if="!standalone">
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

    <MailComposerField label="From">
      <span class="truncate text-sm text-toned">
        {{ account?.name ? `${account.name} <${account.email}>` : account?.email }}
      </span>
    </MailComposerField>

    <MailComposerRecipients />

    <MailComposerField label="Subject">
      <UInput
        v-model="draft.subject"
        aria-label="Subject"
        variant="none"
        :autofocus="!!draft.to.length && !draft.subject"
        :ui="{ base: 'px-0 h-11 text-[15px] font-semibold text-highlighted' }"
        @keydown="onSubjectKey"
      />
    </MailComposerField>

    <MailComposerAi v-if="ready && draft.replyingTo" />
    <MailComposerTranslate v-if="ready && draft.translateTo" />

    <MailComposerBody
      :key="version"
      class="min-h-0 flex-1"
    />
  </section>
</template>
