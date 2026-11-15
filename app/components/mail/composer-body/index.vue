<script setup lang="ts">
import type { EditorEmojiMenuItem, EditorSuggestionMenuItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

const { draft, isDirty, editor, discard, close, attach } = useComposer()
const { writing } = useAiReply()
const { translating, fallback, run: translateReply } = useReplyTranslation()
const { ready: aiReady } = useAi()
const tools = useComposerTools()

const editorEl = useTemplateRef('editorEl')
watchEffect(() => {
  editor.value = editorEl.value?.editor
})

const drop = useComposerDrop(() => editor.value)
const picker = useTemplateRef('picker')
const imagePicker = useTemplateRef('imagePicker')
// Made once: the editor reads its extensions when it is created
const extensions = composerExtensions()

watch(() => tools.pickFiles.value, () => picker.value?.click())
watch(() => tools.pickImage.value, () => imagePicker.value?.click())

async function picked(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    const files = Array.from(input.files)
    await attach(files)
    announce(files.length === 1 ? `${files[0]!.name} attached` : `${files.length} files attached`)
  }
  input.value = ''
}

async function pickedImages(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await drop.insertImages(Array.from(input.files))
  input.value = ''
}

// Slash commands: "/" at the start of a line or after a space lists what the
// composer can do, narrowed as you type. Only what applies to this message is offered
type SlashCommand = 'template' | 'sign' | 'translate' | 'later' | 'tone' | 'attach' | 'focus' | 'emoji' | 'table' | 'image' | 'code'
type SlashItem = EditorSuggestionMenuItem & { command?: SlashCommand }

const slashItems = computed<SlashItem[]>(() => {
  const item = (command: SlashCommand, label: string, description: string, icon: string): SlashItem => ({ kind: 'slash', command, label, description, icon } as SlashItem)
  const items = [item('template', '/template', 'Insert a saved template', 'i-lucide-file-text')]
  items.push(item('sign', '/sign', 'Choose a signature, or none', 'i-lucide-signature'))
  if (aiReady.value && draft.value.translateTo) items.push(item('translate', '/translate', `Translate your reply into ${languageName(draft.value.translateTo)}`, 'i-lucide-languages'))
  items.push(item('later', '/later', 'Choose when this goes out', 'i-lucide-calendar-clock'))
  if (aiReady.value && draft.value.replyingTo) items.push(item('tone', '/tone', 'Rewrite your reply with AI', 'i-lucide-wand-sparkles'))
  items.push(
    item('attach', '/attach', 'Attach files', 'i-lucide-paperclip'),
    item('focus', '/focus', tools.zen.value ? 'Leave distraction-free writing' : 'Distraction-free writing', 'i-lucide-maximize'),
    item('emoji', '/emoji', 'Pick an emoji', 'i-lucide-smile-plus'),
    item('table', '/table', 'Insert a table', 'i-lucide-table'),
    item('image', '/image', 'Put a picture in the message', 'i-lucide-image'),
    item('code', '/code', 'Code block, with colours', 'i-lucide-square-code')
  )
  return items
})

function runSlash(command?: SlashCommand) {
  if (command === 'template') tools.templates.value = true
  else if (command === 'sign') tools.signature.value = true
  else if (command === 'translate') translateReply()
  else if (command === 'later') tools.later.value = true
  else if (command === 'tone') tools.tone.value = true
  else if (command === 'attach') picker.value?.click()
  else if (command === 'focus') tools.zen.value = !tools.zen.value
  else if (command === 'emoji') {
    tools.lastField.value = 'body'
    tools.emoji.value = true
  } else if (command === 'table') tools.table.value = true
  else if (command === 'image') imagePicker.value?.click()
  else if (command === 'code') editor.value?.chain().focus().toggleCodeBlock().run()
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

// ":smi" lists matching emoji; Enter or Tab puts the first in. Only after two
// letters, so a colon at the start of a line doesn't open a list
const emojiItems: EditorEmojiMenuItem[] = EMOJI.map(item => ({ name: item.name, emoji: item.emoji, shortcodes: item.shortcodes, tags: item.tags }))
const emojiSuggestion = { allow: ({ range }: { range: { from: number, to: number } }) => range.to - range.from >= 3 }

const body = () => document.body
</script>

<template>
  <div
    class="relative flex min-h-0 flex-col"
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
      placeholder="Write, or type / for commands and : for emoji. **Bold**, # heading and - list work as you type"
      :autofocus="draft.to.length && draft.subject ? 'start' : false"
      :image="false"
      :starter-kit="{ codeBlock: false }"
      :extensions="extensions"
      :editor-props="{ handlePaste: (_view: unknown, event: ClipboardEvent) => drop.onPaste(event) }"
      :handlers="handlers"
      aria-label="Message"
      class="lb-composer-editor flex min-h-0 flex-1 flex-col overflow-y-auto"
      :class="[writing && 'lb-ai-writing', translating && fallback && 'lb-tr-editing']"
      :ui="{ content: 'order-1 px-5 pt-3 pb-5', base: 'px-0 sm:px-0 min-h-24 text-[15px] leading-normal text-default *:my-0 [&_p]:leading-normal [&_li]:my-0 [&_:is(ul,ol,blockquote,pre,table)]:my-2' }"
    >
      <UEditorSuggestionMenu
        :editor="instance"
        :items="slashItems"
        :append-to="body"
        char="/"
      />
      <UEditorEmojiMenu
        :editor="instance"
        :items="emojiItems"
        :append-to="body"
        :limit="8"
        :suggestion="emojiSuggestion"
      />
      <MailComposerBubbles :editor="instance" />

      <MailComposerExtras class="order-2" />
      <!-- The space under the signature still puts the cursor in the message -->
      <div
        class="order-3 min-h-6 flex-1 cursor-text"
        aria-hidden="true"
        @click="instance.commands.focus('end')"
      />

      <MailComposerAttachments class="order-3" />

      <footer
        data-zen-edge="bottom"
        class="sticky bottom-0 order-4 mt-auto flex items-center gap-0.5 border-t border-default bg-default px-2.5 py-2"
      >
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
        <MailComposerSignature />
        <MailReceiptToggle />
        <MailComposerTemplates />
        <MailComposerTone v-if="aiReady" />
        <input
          ref="picker"
          type="file"
          multiple
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          @change="picked"
        >
        <input
          ref="imagePicker"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          @change="pickedImages"
        >

        <div class="ms-auto flex min-w-0 items-center gap-1">
          <MailComposerToolbar
            :editor="instance"
            extended
          />
          <MailSendButton class="ms-2" />
        </div>
      </footer>
    </UEditor>

    <MailDropZone :drop="drop" />
  </div>
</template>
