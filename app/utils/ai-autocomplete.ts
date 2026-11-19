import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import { cleanCompletion } from './ai-writing'

// Ghost text: when typing pauses at the end of a paragraph, the likely next
// few words show greyed after the cursor. Tab takes them; Escape or any other
// key lets them go. The words are a decoration, never part of the document,
// so they are not saved, sent or counted as an edit until taken

export interface AutocompleteContext {
  /** Up to two paragraphs before the one being typed, nearest last */
  before: string[]
  paragraph: string
}

export interface AutocompleteOptions {
  /** Asked before every request: the feature is on and the editor is free */
  enabled: () => boolean
  /** The model's continuation of the paragraph */
  complete: (context: AutocompleteContext, signal: AbortSignal) => Promise<string>
  /** A suggestion is showing (to tell screen readers) */
  onShow: (text: string) => void
  /** How long typing must pause, in ms */
  delay: number
  /** No new suggestion this soon after one was turned down, in ms */
  rejectPause: number
}

interface Ghost {
  text: string
  pos: number
}

export const autocompleteKey = new PluginKey<Ghost | null>('lb-autocomplete')

/** Where the words can't be guessed or shouldn't be: code and tables */
const NO_SUGGESTIONS = new Set(['codeBlock', 'table'])
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'Fn'])

/**
 * What a suggestion is asked from, or undefined when none should be: the
 * cursor must sit at the very end of a paragraph that has words, outside
 * code and tables
 */
export function completionContext(state: EditorState): AutocompleteContext | undefined {
  const { selection } = state
  if (!selection.empty) return undefined
  const $pos = selection.$from
  const parent = $pos.parent
  if (parent.type.name !== 'paragraph' || $pos.parentOffset !== parent.content.size) return undefined
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (NO_SUGGESTIONS.has($pos.node(depth).type.name)) return undefined
  }
  const paragraph = parent.textBetween(0, parent.content.size, '\n', '\n')
  if (!paragraph.trim()) return undefined

  const before: string[] = []
  state.doc.nodesBetween(0, $pos.before($pos.depth), (node) => {
    if (NO_SUGGESTIONS.has(node.type.name)) return false
    if (!node.isTextblock) return true
    const text = node.textBetween(0, node.content.size, '\n', '\n').trim()
    if (text) before.push(text)
    return false
  })
  return { before: before.slice(-2), paragraph }
}

export const AiAutocomplete = Extension.create<AutocompleteOptions>({
  name: 'aiAutocomplete',
  // Ahead of lists and code blocks, which also want Tab
  priority: 1000,

  addOptions() {
    return {
      enabled: () => false,
      complete: async () => '',
      onShow: () => {},
      delay: 700,
      rejectPause: 3000
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let rejectedAt = 0

    const cancel = () => {
      clearTimeout(timer)
      controller?.abort()
      controller = undefined
    }

    const clear = (view: EditorView) => {
      if (autocompleteKey.getState(view.state)) view.dispatch(view.state.tr.setMeta(autocompleteKey, null))
    }

    async function request(view: EditorView) {
      if (!view.editable || view.composing || !view.hasFocus() || !options.enabled()) return
      if (Date.now() - rejectedAt < options.rejectPause) return
      const context = completionContext(view.state)
      if (!context) return
      const { doc, selection } = view.state
      const mine = controller = new AbortController()
      try {
        const raw = await options.complete(context, mine.signal)
        // Typed on, moved away or closed meanwhile: the guess no longer fits
        if (mine.signal.aborted || view.isDestroyed || view.state.doc !== doc || !view.state.selection.eq(selection)) return
        const text = cleanCompletion(raw, context.paragraph)
        if (!text) return
        view.dispatch(view.state.tr.setMeta(autocompleteKey, { text, pos: selection.from }))
        options.onShow(text)
      } catch {
        // A suggestion that didn't come is no loss: nothing to say
      } finally {
        if (controller === mine) controller = undefined
      }
    }

    return [
      new Plugin<Ghost | null>({
        key: autocompleteKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(autocompleteKey) as Ghost | null | undefined
            if (meta !== undefined) return meta
            return tr.docChanged || tr.selectionSet ? null : value
          }
        },
        props: {
          decorations(state) {
            const ghost = autocompleteKey.getState(state)
            if (!ghost) return null
            return DecorationSet.create(state.doc, [
              Decoration.widget(ghost.pos, () => {
                const span = document.createElement('span')
                span.className = 'lb-ghost'
                span.textContent = ghost.text
                // Screen readers hear it once, from the live region, not as part of the text
                span.setAttribute('aria-hidden', 'true')
                span.contentEditable = 'false'
                return span
              }, { side: 1, key: `ghost:${ghost.pos}:${ghost.text}` })
            ])
          },
          handleKeyDown(view, event) {
            // Every key stops a guess on its way: it was for the text before it
            cancel()
            const ghost = autocompleteKey.getState(view.state)
            if (!ghost || MODIFIERS.has(event.key)) return false
            if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
              const tr = view.state.tr.insertText(ghost.text, ghost.pos).setMeta(autocompleteKey, null)
              view.dispatch(tr.setSelection(TextSelection.create(tr.doc, ghost.pos + ghost.text.length)).scrollIntoView())
              return true
            }
            rejectedAt = Date.now()
            clear(view)
            // Escape is used up here, so it doesn't also tuck the composer away
            return event.key === 'Escape'
          },
          handleDOMEvents: {
            blur: (view) => {
              cancel()
              clear(view)
              return false
            }
          }
        },
        view: () => ({
          update: (view, previous) => {
            if (view.state.doc !== previous.doc) {
              cancel()
              timer = setTimeout(() => request(view), options.delay)
            } else if (!view.state.selection.eq(previous.selection)) {
              cancel()
            }
          },
          destroy: cancel
        })
      })
    ]
  }
})
