import type { Editor } from '@tiptap/vue-3'

const MAX_WIDTH = 1600
/** A picture in the message, after scaling down */
const MAX_PICTURE = 2 * 1024 * 1024
// The send endpoint takes up to 5 MB of HTML, and pictures in the message
// travel inside it as text: this leaves room for the words and the quote
const MAX_HTML = 4.5 * 1024 * 1024

const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)

/**
 * A picture as a data URL, scaled down to 1600 pixels wide so a phone photo
 * doesn't weigh 8 MB. Animated GIFs are kept as they are (a canvas would
 * stop them)
 */
async function inlineImage(file: File): Promise<string> {
  const original = async () => `data:${file.type};base64,${await blobToBase64(file)}`
  if (file.type === 'image/gif') return original()
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return original()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86)
}

export const isInlineImage = (file: File) => /^image\/(png|jpe?g|gif|webp)$/.test(file.type)

/**
 * Files dragged over the composer. Pictures can go in the message itself or
 * on as attachments, depending on which half they're dropped on; anything else
 * is attached. Pasted pictures go in the message
 */
export function useComposerDrop(editor: () => Editor | undefined) {
  const { attach, draft } = useComposer()
  const toast = useToast()
  const dragging = ref(false)
  const images = ref(0)
  const files = ref(0)
  let depth = 0

  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  function onEnter(event: DragEvent) {
    if (!carriesFiles(event)) return
    event.preventDefault()
    depth++
    dragging.value = true
    const items = Array.from(event.dataTransfer?.items ?? []).filter(item => item.kind === 'file')
    files.value = items.length
    images.value = items.filter(item => /^image\/(png|jpe?g|gif|webp)$/.test(item.type)).length
  }

  function onOver(event: DragEvent) {
    if (carriesFiles(event)) event.preventDefault()
  }

  function onLeave() {
    depth = Math.max(0, depth - 1)
    if (!depth) dragging.value = false
  }

  /** Puts pictures in the message where the cursor is. Too large ones are left out, with a word why */
  async function insertImages(list: File[]) {
    const live = editor()
    if (!live) return
    let budget = MAX_HTML - draft.value.html.length
    const placed: { src: string, alt: string }[] = []
    for (const file of list.filter(isInlineImage)) {
      const src = await inlineImage(file).catch(() => undefined)
      if (!src) {
        toast.add({ title: `Couldn’t read ${file.name}`, color: 'warning', icon: 'i-lucide-image-off' })
        continue
      }
      if (bytesOf(src) > MAX_PICTURE) {
        toast.add({ title: `${file.name} is too large to put in the message`, description: `Pictures in the message can be 2 MB at most, even scaled down (this one is ${formatSize(bytesOf(src))}). Attach it instead.`, color: 'warning', icon: 'i-lucide-image-off' })
        continue
      }
      if (src.length > budget) {
        toast.add({ title: 'No room for more pictures in the message', description: 'Pictures in the message share about 4 MB. Attach the rest instead.', color: 'warning', icon: 'i-lucide-image-off' })
        break
      }
      budget -= src.length
      placed.push({ src, alt: file.name.replace(/\.[^.]+$/, '') })
    }
    if (!placed.length) return
    const chain = live.chain().focus()
    for (const image of placed) chain.setImage(image)
    chain.run()
    announce(placed.length === 1 ? 'Picture added to the message' : `${placed.length} pictures added to the message`)
  }

  async function onDrop(event: DragEvent, target: 'inline' | 'attach') {
    event.preventDefault()
    depth = 0
    dragging.value = false
    const dropped = Array.from(event.dataTransfer?.files ?? [])
    if (!dropped.length) return
    const pictures = target === 'inline' ? dropped.filter(isInlineImage) : []
    const rest = dropped.filter(file => !pictures.includes(file))
    if (pictures.length) await insertImages(pictures)
    if (rest.length) {
      await attach(rest)
      announce(rest.length === 1 ? `${rest[0]!.name} attached` : `${rest.length} files attached`)
    }
  }

  /** For the editor's paste: pictures from the clipboard go in the message */
  function onPaste(event: ClipboardEvent) {
    const pictures = Array.from(event.clipboardData?.files ?? []).filter(isInlineImage)
    if (!pictures.length) return false
    insertImages(pictures)
    return true
  }

  return { dragging, images, files, onEnter, onOver, onLeave, onDrop, onPaste, insertImages }
}
