<script setup lang="ts">
import type { EditorSuggestionMenuItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

const { draft, isDirty, editor, discard, close, attach } = useComposer()
const { writing } = useAiReply()
const { translating, fallback, run: translateReply } = useReplyTranslation()
const { ready: aiReady } = useAi()
const { settings } = useSettings()
const tools = useComposerTools()

const editorEl = useTemplateRef('editorEl')
watchEffect(() => {
  editor.value = editorEl.value?.editor
})

const drop = useComposerDrop(() => editor.value)
const picker = useTemplateRef('picker')

async function picked(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await attach(Array.from(input.files))
  input.value = ''
}

// Slash commands: "/" at the start of a line or after a space lists what the
// composer can do, narrowed as you type. Only what applies to this message is offered
type SlashCommand = 'template' | 'sign' | 'translate' | 'later' | 'tone' | 'attach'
type SlashItem = EditorSuggestionMenuItem & { command?: SlashCommand }

const slashItems = computed<SlashItem[]>(() => {
  const item = (command: SlashCommand, label: string, description: string, icon: string): SlashItem => ({ kind: 'slash', command, label, description, icon } as SlashItem)
  const items = [item('template', '/template', 'Insert a saved template', 'i-lucide-file-text')]
  if (settings.value.signature) items.push(item('sign', '/sign', draft.value.signature ? 'Leave out your signature' : 'Add your signature', 'i-lucide-signature'))
  if (aiReady.value && draft.value.translateTo) items.push(item('translate', '/translate', `Translate your reply into ${languageName(draft.value.translateTo)}`, 'i-lucide-languages'))
  items.push(item('later', '/later', 'Choose when this goes out', 'i-lucide-calendar-clock'))
  if (aiReady.value && draft.value.replyingTo) items.push(item('tone', '/tone', 'Rewrite your reply with AI', 'i-lucide-wand-sparkles'))
  items.push(item('attach', '/attach', 'Attach files', 'i-lucide-paperclip'))
  return items
})

function runSlash(command?: SlashCommand) {
  if (command === 'template') tools.templates.value = true
  else if (command === 'sign') draft.value.signature = !draft.value.signature
  else if (command === 'translate') translateReply()
  else if (command === 'later') tools.later.value = true
  else if (command === 'tone') tools.tone.value = true
  else if (command === 'attach') picker.value?.click()
}

// The menu removes the typed "/word" itself, then asks this to act. The
// command waits a tick, so a pop-up it opens isn't closed by the same key press
const handlers = {
  slash: {
    canExecute: () => true,
    execute: (instance: Editor, item: SlashItem) => {
      setTimeout(() => runSlash(item.command), 0)
      return instance.chain()
    },
    isActive: () => false
  }
}

const body = () => document.body
</script>

<template>
  <div
    class="relative flex flex-col min-h-0"
    @dragenter="drop.onEnter"
    @dragover="drop.onOver"
    @dragleave="drop.onLeave"
    @drop.prevent="drop.onDrop($event, 'attach')"
  >
    <UEditor
      ref="editorEl"
      v-slot="{ editor: instance }"
      v-model="draft.html"
      content-type="html"
      placeholder="Write your message, or type / for commands"
      :autofocus="draft.to.length && draft.subject ? 'start' : false"
      :image="{ allowBase64: true, HTMLAttributes: { style: 'max-width:100%;height:auto' } }"
      :editor-props="{ handlePaste: (_view: unknown, event: ClipboardEvent) => drop.onPaste(event) }"
      :handlers="handlers"
      class="flex-1 flex flex-col min-h-0 overflow-y-auto"
      :class="[writing && 'lb-ai-writing', translating && fallback && 'lb-tr-editing']"
      :ui="{ content: 'order-1 px-5 pt-4 pb-5', base: 'px-0 sm:px-0 min-h-24 text-[15px] leading-normal text-default *:my-0 [&_p]:leading-normal [&_li]:my-0 [&_:is(ul,ol,blockquote,pre)]:my-2 [&_img]:rounded-md [&_img]:my-2 [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary' }"
    >
      <UEditorSuggestionMenu
        :editor="instance"
        :items="slashItems"
        :append-to="body"
        char="/"
      />

      <MailComposerExtras class="order-2" />
      <!-- The space under the signature still puts the cursor in the message -->
      <div
        class="order-3 flex-1 min-h-6 cursor-text"
        @click="instance.commands.focus('end')"
      />

      <MailComposerAttachments class="order-3" />

      <footer class="order-4 sticky bottom-0 mt-auto flex items-center gap-1 px-3 py-2.5 border-t border-default bg-default">
        <UTooltip :text="isDirty ? 'Discard draft' : 'Close'">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :aria-label="isDirty ? 'Discard draft' : 'Close'"
            @click="isDirty ? discard() : close()"
          />
        </UTooltip>
        <UTooltip text="Attach files">
          <UButton
            icon="i-lucide-paperclip"
            color="neutral"
            variant="ghost"
            aria-label="Attach files"
            @click="picker?.click()"
          />
        </UTooltip>
        <MailReceiptToggle />
        <MailComposerTemplates />
        <MailComposerTone v-if="aiReady" />
        <input
          ref="picker"
          type="file"
          multiple
          class="hidden"
          @change="picked"
        >

        <div class="ms-auto flex items-center gap-1">
          <MailComposerToolbar :editor="instance" />
          <MailSendButton class="ms-2" />
        </div>
      </footer>
    </UEditor>

    <MailDropZone :drop="drop" />
  </div>
</template>
