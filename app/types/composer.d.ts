/** A saved snippet, put into a message from the composer's toolbar or with /template */
interface ComposeTemplate {
  id: string
  name: string
  /** Used when the message has no subject yet */
  subject?: string
  html: string
}

/** How often and how recently you wrote to one address */
interface RecipientStat {
  name?: string
  /** Messages sent to them from this computer */
  count: number
  /** When the last one went, ms since epoch */
  last: number
  /** Addresses that were on the same messages, and how many times */
  with: Record<string, number>
}

/** Everyone you wrote to from this computer, by lowercased address */
type RecipientTally = Record<string, RecipientStat>

/** A draft that was closed or thrown away, kept for a while so it can be brought back */
interface ClosedDraft {
  id: string
  /** ms since epoch */
  closedAt: number
  /** Attachments too big to keep here were left out: how many */
  droppedFiles?: number
  draft: import('~/composables/useComposer').Draft
}
