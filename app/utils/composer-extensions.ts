import type { Extensions } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Image } from '@tiptap/extension-image'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

// What the composer's editor adds to UEditor's own set: tables, coloured
// code blocks and pictures that can be resized. The rest (bold, lists,
// headings, quotes, rules and their Markdown shortcuts) comes with UEditor

const MIN_IMAGE = 48

/**
 * A picture in the message. Its width is kept as an attribute (sent as a
 * style too, see outgoing-html), and while it is selected four corner
 * handles resize it, keeping its proportions
 */
export const MailImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          // Pixels only: a width in % or em means nothing to the handles
          const value = element.getAttribute('width') ?? element.style.width
          const pixels = /^\s*\d+(\.\d+)?(px)?\s*$/.test(value ?? '') ? Number.parseInt(value!, 10) : Number.NaN
          return Number.isFinite(pixels) && pixels > 0 ? pixels : null
        },
        renderHTML: (attributes: { width?: number | null }) => attributes.width ? { width: attributes.width } : {}
      },
      // A width is enough: the height follows the picture's proportions
      height: { default: null, parseHTML: () => null, renderHTML: () => ({}) }
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node
      const dom = document.createElement('span')
      dom.className = 'lb-image'
      dom.contentEditable = 'false'
      const img = document.createElement('img')
      img.draggable = false
      dom.append(img)

      const paint = () => {
        img.src = current.attrs.src ?? ''
        img.alt = current.attrs.alt ?? ''
        if (current.attrs.title) img.title = current.attrs.title
        img.style.width = current.attrs.width ? `${current.attrs.width}px` : ''
      }
      paint()

      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const handle = document.createElement('span')
        handle.className = 'lb-image-handle'
        handle.dataset.corner = corner
        handle.setAttribute('aria-hidden', 'true')
        handle.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const startX = event.clientX
          const startWidth = img.getBoundingClientRect().width
          const limit = (editor.view.dom as HTMLElement).clientWidth
          // Handles on the left grow the picture as they move left
          const sign = corner.endsWith('w') ? -1 : 1
          const widthAt = (x: number) => Math.round(Math.min(limit, Math.max(MIN_IMAGE, startWidth + sign * (x - startX))))
          handle.setPointerCapture(event.pointerId)
          dom.dataset.resizing = 'true'
          const move = (next: PointerEvent) => {
            img.style.width = `${widthAt(next.clientX)}px`
          }
          const done = (last: PointerEvent) => {
            handle.removeEventListener('pointermove', move)
            handle.removeEventListener('pointerup', done)
            handle.removeEventListener('pointercancel', done)
            delete dom.dataset.resizing
            const pos = typeof getPos === 'function' ? getPos() : undefined
            if (pos === undefined) return
            editor.chain().setNodeSelection(pos).updateAttributes('image', { width: widthAt(last.clientX) }).run()
          }
          handle.addEventListener('pointermove', move)
          handle.addEventListener('pointerup', done)
          handle.addEventListener('pointercancel', done)
        })
        dom.append(handle)
      }

      return {
        dom,
        update: (updated) => {
          if (updated.type !== current.type) return false
          current = updated
          paint()
          return true
        },
        selectNode: () => dom.classList.add('ProseMirror-selectednode'),
        deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
        // Drags on the handles are the node view's own business
        stopEvent: event => event.target instanceof HTMLElement && event.target.classList.contains('lb-image-handle'),
        ignoreMutation: () => true
      }
    }
  }
}).configure({ allowBase64: true, inline: false })

export function composerExtensions(): Extensions {
  return [
    MailImage,
    Table.configure({ resizable: false, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext', enableTabIndentation: true })
  ]
}
