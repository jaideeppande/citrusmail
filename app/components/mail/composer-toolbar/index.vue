<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
  /** The composer's own extras (code, emoji, tables, pictures), which need its editor extensions */
  extended?: boolean
}>()

const tools = useComposerTools()
const root = useTemplateRef('root')
// One Tab stop for the whole toolbar; the arrow keys move along it
useRovingFocus(root)

const items = computed<EditorToolbarItem[][]>(() => {
  const groups: EditorToolbarItem[][] = [[
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold', kbds: ['meta', 'b'] } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic', kbds: ['meta', 'i'] } },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline', kbds: ['meta', 'u'] } },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } }
  ], [
    { slot: 'link' as const, icon: 'i-lucide-link' },
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bulleted list' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } },
    { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } }
  ]]
  if (props.extended) {
    groups.push([
      { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: 'Code block' } },
      { slot: 'table' as const, icon: 'i-lucide-table' },
      { slot: 'image' as const, icon: 'i-lucide-image' },
      { slot: 'emoji' as const, icon: 'i-lucide-smile-plus' }
    ])
  }
  return groups
})
</script>

<template>
  <div
    ref="root"
    class="min-w-0"
  >
    <UEditorToolbar
      :editor="editor"
      :items="items"
      aria-label="Formatting"
      class="overflow-x-auto max-sm:hidden"
      :ui="{ separator: 'h-4' }"
    >
      <template #link>
        <EditorLinkPopover :editor="editor" />
      </template>
      <template #table>
        <MailComposerTablePicker :editor="editor" />
      </template>
      <template #image>
        <UTooltip text="Picture in the message">
          <UButton
            icon="i-lucide-image"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Put a picture in the message"
            @click="tools.pickImage.value++"
          />
        </UTooltip>
      </template>
      <template #emoji>
        <MailComposerEmoji :editor="editor" />
      </template>
    </UEditorToolbar>
  </div>
</template>
