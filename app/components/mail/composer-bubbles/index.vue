<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

// Small menus that float by what the cursor is in: a table (rows, columns,
// header), a picture (size, alt text) or a code block (its language)
const props = defineProps<{
  editor: Editor
}>()

interface ShowArgs { editor: Editor, view: EditorView, state: EditorState, element: HTMLElement }

// Shown while the editor (or the menu itself) has the cursor
const showFor = (name: string, unless?: string) => ({ editor, view, element }: ShowArgs) =>
  editor.isEditable && editor.isActive(name) && !(unless && editor.isActive(unless))
  && (view.hasFocus() || element.contains(document.activeElement))

const run = (label: string, action: (editor: Editor) => boolean) => () => {
  if (action(props.editor)) announce(label)
}

const tableItems: EditorToolbarItem[][] = [[
  { icon: 'i-lucide-between-vertical-end', tooltip: { text: 'Add row below' }, onClick: run('Row added', e => e.chain().focus().addRowAfter().run()) },
  { icon: 'i-lucide-between-horizontal-end', tooltip: { text: 'Add column to the right' }, onClick: run('Column added', e => e.chain().focus().addColumnAfter().run()) }
], [
  { icon: 'i-lucide-rows-3', tooltip: { text: 'Remove row' }, onClick: run('Row removed', e => e.chain().focus().deleteRow().run()) },
  { icon: 'i-lucide-columns-3', tooltip: { text: 'Remove column' }, onClick: run('Column removed', e => e.chain().focus().deleteColumn().run()) }
], [
  { icon: 'i-lucide-heading', tooltip: { text: 'Header row on or off' }, onClick: run('Header row changed', e => e.chain().focus().toggleHeaderRow().run()) },
  { icon: 'i-lucide-trash-2', tooltip: { text: 'Delete table' }, onClick: run('Table deleted', e => e.chain().focus().deleteTable().run()) }
]]

const SMALL = 240
const MEDIUM = 480
const widthOf = (editor: Editor) => {
  const dom = editor.view.dom as HTMLElement
  const style = getComputedStyle(dom)
  return Math.round(dom.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight))
}
const resize = (label: string, width: (editor: Editor) => number) =>
  run(`Picture set to ${label.toLowerCase()}`, e => e.chain().focus().updateAttributes('image', { width: width(e) }).run())

const imageItems: EditorToolbarItem[][] = [[
  { label: 'Small', tooltip: { text: `${SMALL} pixels wide` }, onClick: resize('Small', () => SMALL) },
  { label: 'Medium', tooltip: { text: `${MEDIUM} pixels wide` }, onClick: resize('Medium', () => MEDIUM) },
  { label: 'Full width', tooltip: { text: 'As wide as the message' }, onClick: resize('Full width', widthOf) }
], [
  { slot: 'alt' as const }
], [
  { icon: 'i-lucide-trash-2', tooltip: { text: 'Remove picture' }, onClick: run('Picture removed', e => e.chain().focus().deleteSelection().run()) }
]]

// The alt text is read when the picture is selected and saved as it is typed
const alt = ref('')
const syncAlt = () => {
  if (props.editor.isActive('image')) alt.value = props.editor.getAttributes('image').alt ?? ''
}
props.editor.on('selectionUpdate', syncAlt)
onBeforeUnmount(() => props.editor.off('selectionUpdate', syncAlt))

function saveAlt() {
  props.editor.chain().updateAttributes('image', { alt: alt.value.trim() || null }).run()
}

const language = ref('plaintext')
const syncLanguage = () => {
  if (props.editor.isActive('codeBlock')) language.value = codeLanguage(props.editor.getAttributes('codeBlock').language)
}
props.editor.on('selectionUpdate', syncLanguage)
onBeforeUnmount(() => props.editor.off('selectionUpdate', syncLanguage))

function setLanguage() {
  props.editor.chain().focus().updateAttributes('codeBlock', { language: language.value }).run()
  announce(`Code language: ${CODE_LANGUAGES.find(item => item.value === language.value)?.label ?? language.value}`)
}
</script>

<template>
  <UEditorToolbar
    :editor="editor"
    :items="tableItems"
    layout="bubble"
    plugin-key="lbTableMenu"
    aria-label="Table"
    :should-show="showFor('table', 'image')"
    :options="{ placement: 'top' }"
  />

  <UEditorToolbar
    :editor="editor"
    :items="imageItems"
    layout="bubble"
    plugin-key="lbImageMenu"
    aria-label="Picture"
    :should-show="showFor('image')"
    :options="{ placement: 'top' }"
  >
    <template #alt>
      <UInput
        v-model="alt"
        size="sm"
        placeholder="Describe the picture"
        aria-label="Alt text, read out to people who can’t see the picture"
        class="w-44"
        @change="saveAlt"
        @keydown.enter.prevent="saveAlt(); editor.commands.focus()"
      />
    </template>
  </UEditorToolbar>

  <UEditorToolbar
    :editor="editor"
    :items="[[{ slot: 'language' as const }]]"
    layout="bubble"
    plugin-key="lbCodeMenu"
    aria-label="Code block"
    :should-show="showFor('codeBlock')"
    :options="{ placement: 'top-end' }"
  >
    <template #language>
      <label class="flex items-center gap-1.5 ps-1.5 text-xs text-muted">
        Language
        <!-- A native list: the editor keeps the menu while it is open -->
        <select
          v-model="language"
          class="lb-focus h-7 rounded-md bg-elevated px-1.5 text-sm text-highlighted"
          @change="setLanguage"
        >
          <option
            v-for="item in CODE_LANGUAGES"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
    </template>
  </UEditorToolbar>
</template>
