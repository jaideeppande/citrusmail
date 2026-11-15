// Labels: colour tags you put on messages. A mail server has folders, not
// labels, so these live on this computer (see useLabels)

export interface MailLabel {
  id: string
  name: string
  color: LabelColor
}

/** The colours a label can have. Each is a CSS variable set for light and dark in main.css */
export const LABEL_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'grey'] as const
export type LabelColor = typeof LABEL_COLORS[number]

export const labelVar = (color: LabelColor) => `var(--lb-label-${color})`

/**
 * What a label is attached to. The Message-ID header when the server gave
 * one, since it stays the same when a message moves to another folder; the
 * folder and id otherwise
 */
export const labelKey = (message: Pick<MessageSummary, 'folder' | 'id' | 'messageId'>) => message.messageId || messageKey(message)

/* Searching every folder -------------------------------------------- */

export interface SearchQuery {
  /** The words, with the operators taken out */
  text: string
  from?: string
  /** A folder name as typed after in: */
  folder?: string
  unread?: boolean
  flagged?: boolean
  attachments?: boolean
  /** Inclusive day bounds, YYYY-MM-DD */
  after?: string
  before?: string
  label?: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads a search as typed: words, and operators such as from:ana
 * has:attachment is:unread before:2026-01-31 in:archive label:todo.
 * A value with spaces goes in quotes. An operator it doesn't know stays a word
 */
export function parseSearch(input: string): SearchQuery {
  const query: SearchQuery = { text: '' }
  const words: string[] = []
  for (const match of input.matchAll(/(\w+):("([^"]*)"|\S+)|"([^"]*)"|\S+/g)) {
    const [token, operator, raw, quoted, phrase] = match
    const value = (quoted ?? raw ?? '').trim()
    switch (operator?.toLowerCase()) {
      case 'from':
        query.from = value
        break
      case 'in':
        query.folder = value
        break
      case 'label':
        query.label = value
        break
      case 'has':
        if (/^attach/i.test(value) || /^files?$/i.test(value)) query.attachments = true
        else words.push(token)
        break
      case 'is':
        if (/^unread$/i.test(value)) query.unread = true
        else if (/^(flagged|starred)$/i.test(value)) query.flagged = true
        else if (/^read$/i.test(value)) query.unread = false
        else words.push(token)
        break
      case 'after':
      case 'since':
        if (DAY.test(value)) query.after = value
        else words.push(token)
        break
      case 'before':
      case 'until':
        if (DAY.test(value)) query.before = value
        else words.push(token)
        break
      default:
        words.push(phrase ?? token)
    }
  }
  query.text = words.join(' ')
  return query
}

/** Whether a search asks for anything at all */
export function isEmptySearch(query: SearchQuery) {
  return !query.text && !query.from && query.unread === undefined && !query.flagged && !query.attachments && !query.after && !query.before && !query.label
}

/** What the list endpoint can't narrow by itself, checked here: the day bounds and read mail */
export function matchesSearch(message: MessageSummary, query: SearchQuery) {
  const day = message.date.slice(0, 10)
  if (query.after && day < query.after) return false
  if (query.before && day > query.before) return false
  if (query.unread === false && message.unread) return false
  return true
}
