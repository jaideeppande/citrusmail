import { addHours, startOfHour } from 'date-fns'

const WORDS_A_MINUTE = 220

// Several parts of the reader ask for the same message's text (reading time,
// the chips, summaries): the HTML is only taken apart once
const texts = new Map<string, string>()

/** A message's words as plain text: its text part, or what its HTML says */
export function messageText(message: Pick<MessageDetail, 'text' | 'html'> & Partial<Pick<MessageDetail, 'id' | 'folder'>>): string {
  if (message.text) return message.text
  if (!message.html || !import.meta.client) return ''
  const key = `${message.folder}\0${message.id}\0${message.html.length}`
  const known = texts.get(key)
  if (known !== undefined) return known
  // A parsed document never runs or loads anything, so this is safe on mail HTML
  const doc = new DOMParser().parseFromString(message.html, 'text/html')
  doc.querySelectorAll('style, script, head').forEach(node => node.remove())
  doc.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
  doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, blockquote').forEach(node => node.append('\n'))
  const text = (doc.body.textContent ?? '').replace(/[ \t\xA0]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
  texts.set(key, text)
  if (texts.size > 24) texts.delete(texts.keys().next().value!)
  return text
}

/** Minutes it takes to read, 0 for anything under a minute */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return words < WORDS_A_MINUTE ? 0 : Math.round(words / WORDS_A_MINUTE)
}

export function attachmentUrl(message: Pick<MessageSummary, 'id' | 'folder'>, index: number): string {
  return `/api/messages/${encodeURIComponent(message.id)}/attachments/${index}?folder=${encodeURIComponent(message.folder)}`
}

/** A calendar file, by its type or its name */
export function isInvite(file: Attachment): boolean {
  return /^(text\/calendar|application\/ics)\b/i.test(file.contentType) || /\.ics$/i.test(file.filename)
}

/** What the browser can show in place: 'image', 'text', or nothing (it opens in its own tab or downloads) */
export function previewKind(file: Attachment): 'image' | 'text' | undefined {
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.contentType)) return 'image'
  if (/^text\/(plain|csv|calendar|markdown)\b/i.test(file.contentType) || /\.(txt|csv|md|log|ics|json)$/i.test(file.filename)) return 'text'
  return undefined
}

/** The next full hour, where a new event starts when nothing says otherwise */
export function nextRoundHour(from = new Date()): Date {
  return addHours(startOfHour(from), 1)
}
