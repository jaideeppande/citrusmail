import type { Editor } from '@tiptap/vue-3'
import { MailComposerGuardDialog } from '#components'

export interface Draft {
  /** Tells the open drafts apart */
  id: string
  to: Address[]
  cc: Address[]
  bcc: Address[]
  subject: string
  html: string
  attachments: OutgoingAttachment[]
  inReplyTo?: string
  references?: string[]
  /** Whether a signature goes under this message */
  signature: boolean
  /** Which one: an extra signature's id (see useSignatures); unset is the default one */
  signatureId?: string
  /** The original of a reply or forward, sent under the signature as is */
  quote?: string
  /** The same original as text, for the preview under the editor */
  quoteText?: string
  /** The copy in the Drafts folder, replaced on each save and removed once sent */
  savedAs?: DraftRef
  /** The message a reply answers, so AI can read it */
  replyingTo?: { folder: string, id: string }
  /** You read the original translated: the language it was in, to offer your reply in */
  translateTo?: string
  /** Track delivery and opens (see mail/receipt-toggle); unset follows Settings → Tracking */
  readReceipt?: boolean
  /** The draft as it was handed to the composer (see fingerprint), so a prefilled reply doesn't count as changed */
  baseline?: string
  /** The mailbox it is written from */
  account?: string
  /** Open in a window of its own since this time (ms), so the dock leaves it alone */
  popped?: number
}

const STORE = 'citrusmail-drafts'
// Web Locks tell one window whether another is still there: a main window
// holds the first for as long as it lives, a composer window holds one for
// each draft it shows
const WINDOW_LOCK = 'citrusmail-composer'
const draftLock = (id: string) => `citrusmail-draft-${id}`
const CLOSED_KEPT = 10
// Local storage is small: big files aren't copied into the closed drafts
const CLOSED_FILES_LIMIT = 512 * 1024

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function emptyDraft(): Draft {
  return { id: newId(), to: [], cc: [], bcc: [], subject: '', html: '', attachments: [], signature: true }
}

/** The message as lines of plain text, for the checks before sending */
function plainText(html: string): string {
  const lines = html.replace(/<\/(p|div|li|h[1-6]|blockquote)>|<br\s*\/?>/gi, '$&\n')
  return (new DOMParser().parseFromString(lines, 'text/html').body.textContent ?? '').trim()
}

/** What a draft is called on its tab and in lists */
export function draftTitle(draft: Draft): string {
  if (draft.subject.trim()) return draft.subject.trim()
  if (draft.inReplyTo) return 'Reply'
  if (draft.quote) return 'Forward'
  return draft.savedAs ? 'Draft' : 'New message'
}

function prefixed(prefix: string, subject: string): string {
  return new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`
}

/** What a person actually changed: recipients, subject, words and files */
function fingerprint(draft: Draft) {
  const words = draft.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return JSON.stringify([draft.to, draft.cc, draft.bcc, draft.subject, words, draft.attachments.length, /<img/i.test(draft.html)])
}

// The original under a reply or forward: a header line and the message in a
// blockquote, which every mail program renders the same. It stays out of the
// editor, so the signature can sit between your words and the quote
function quote(message: MessageDetail, intro: string): Pick<Draft, 'quote' | 'quoteText'> {
  const text = (message.text?.trim() || (message.html ? new DOMParser().parseFromString(message.html, 'text/html').body.textContent ?? '' : '')).trim()
  // The HTML keeps headings, lists and links; text is the fallback
  const body = message.html?.trim()
    ? message.html
    : text.split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')

  return {
    quote: `<br><p>${escapeHtml(intro).replace(/\n/g, '<br>')}</p><blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote>`,
    quoteText: `${intro}\n\n${text}`
  }
}

// One composer for the whole app, opened from mail, contacts or a shortcut.
// Several messages can be open at once: one is on screen, the others wait as
// tabs along the bottom of the window. All of them live in local storage, so
// they survive a reload, a crash and a restart. Closing one with something
// written saves it to Drafts
const _useComposer = () => {
  const toast = useToast()
  const overlay = useOverlay()
  const route = useRoute()
  const { account } = useShell()
  const { settings } = useSettings()
  const prefs = usePrefs()
  const { refresh: refreshScheduled, draftsLink } = useScheduled()
  const { recall } = useTranslationMemory()
  const { contacts } = useContacts()
  const tally = useAccountPref<RecipientTally>('recipients', () => ({}))
  const signatures = useSignatures()
  const closed = useAccountPref<ClosedDraft[]>('closed-drafts', () => [])

  renameStoredKey('letterbox-draft', 'citrusmail-draft')
  renameStoredKey('letterbox-draft-baseline', 'citrusmail-draft-baseline')
  const stored = useLocalStorage<Draft[]>(STORE, [])
  migrateSingleDraft()

  /** The window is the composer and nothing else (pages/compose.vue): no dock */
  const standalone = computed(() => route.path === '/compose')
  const sending = ref(false)
  // Kept for this window only, so a reload shows what was on screen. The
  // panes of a split layout share it with the window they sit in, whose dock
  // shows what a pane starts; a pop-out keeps its own under its window name
  const scope = windowKind() === 'popout' ? `-${window.name}` : ''
  const open = useSessionStorage(`citrusmail-draft-open${scope}`, false)
  const activeId = useSessionStorage(`citrusmail-draft-active${scope}`, '')
  // Bumped whenever another draft takes the screen, so the editor remounts
  // with the new content instead of keeping what it had
  const version = ref(0)
  /** Work still under way after a draft left the screen: a save to Drafts, a send that can be undone */
  const pending = ref(0)

  const mine = (draft: Draft) => !draft.account || draft.account === account.value?.email
  const find = (id: string) => stored.value.find(item => item.id === id)
  /** The tabs of the dock: this mailbox's drafts that aren't in a window of their own */
  const drafts = computed(() => stored.value.filter(item => mine(item) && !item.popped))
  const active = computed(() => stored.value.find(item => item.id === activeId.value && (standalone.value || !item.popped)))
  const hasDraft = computed(() => !!active.value)
  // What the fields bind to when nothing is open, so they never meet undefined
  const scratch = ref<Draft>(emptyDraft())
  /** The draft on screen. Components change it in place */
  const draft = computed<Draft>({
    get: () => active.value ?? scratch.value,
    set: (value) => {
      if (active.value) stored.value = stored.value.map(item => item.id === activeId.value ? { ...value, id: item.id } : item)
      else put({ ...value, id: newId() })
    }
  })

  const dirty = (item: Draft) => fingerprint(item) !== item.baseline
  const isDirty = computed(() => !!active.value && dirty(active.value))

  // Its draft went (sent or closed from another window): nothing to show
  watch(active, (value) => {
    if (!value && open.value) open.value = false
  }, { immediate: true })

  // The one draft the app used to keep becomes the first of the many
  function migrateSingleDraft() {
    try {
      const old = localStorage.getItem('citrusmail-draft')
      if (old === null) return
      const before: Draft = { ...emptyDraft(), ...JSON.parse(old) }
      const baseline = localStorage.getItem('citrusmail-draft-baseline') ?? fingerprint(emptyDraft())
      if (fingerprint(before) !== baseline) stored.value = [...stored.value, { ...before, baseline }]
      localStorage.removeItem('citrusmail-draft')
      localStorage.removeItem('citrusmail-draft-baseline')
    } catch {
      // Storage is off or the old draft is unreadable: nothing to bring over
    }
  }

  // The editor registers itself, so the subject's Tab can land in it
  const editor = shallowRef<Editor>()
  function focusBody() {
    editor.value?.commands.focus('start')
  }

  /** Shows a draft, in place of an untouched one on screen so empties never stack up */
  function put(fresh: Draft) {
    const current = active.value
    const replaced = current && open.value && !dirty(current) ? current.id : undefined
    // In a window of its own, the main window's dock is told to leave it alone
    if (standalone.value) {
      fresh.popped = Date.now()
      hold(fresh.id)
    }
    stored.value = [...stored.value.filter(item => item.id !== replaced), fresh]
    activeId.value = fresh.id
    version.value++
    open.value = true
  }

  function start(next: Partial<Draft> = {}) {
    const isReply = Boolean(next.quote)
    const fresh: Draft = { ...emptyDraft(), signature: !isReply || settings.value.signatureOnReplies, ...next, id: newId(), account: account.value?.email, popped: undefined }
    fresh.baseline = fingerprint(fresh)
    put(fresh)
  }

  function compose(to: Address[] = []) {
    start({ to })
  }

  /** A link like mailto:ana@example.com?subject=Hello, clicked here or anywhere on the computer */
  function composeFromMailto(url: string) {
    start(parseMailto(url))
  }

  /** What a reply to a message starts from: who it goes to, the subject and the original underneath */
  function replyFields(message: MessageDetail, all = false): Partial<Draft> {
    const self = account.value?.email.toLowerCase()
    const primary = message.replyTo.length ? message.replyTo : [message.from]
    const others = all
      ? [...message.to, ...message.cc].filter(address => address.address.toLowerCase() !== self && !primary.some(p => p.address.toLowerCase() === address.address.toLowerCase()))
      : []

    return {
      to: primary,
      cc: others,
      subject: prefixed('Re', message.subject),
      ...quote(message, `On ${fullDate(message.date)}, ${formatAddress(message.from)} wrote:`),
      inReplyTo: message.messageId,
      references: [...(message.references ?? []), ...(message.messageId ? [message.messageId] : [])],
      replyingTo: { folder: message.folder, id: message.id },
      translateTo: translatedFrom(message)
    }
  }

  function reply(message: MessageDetail, all = false) {
    start(replyFields(message, all))
  }

  /** A reply that isn't in the dock: the quick reply under a message sends one of these */
  function replyDraft(message: MessageDetail, all = false): Draft {
    const fresh: Draft = { ...emptyDraft(), signature: settings.value.signatureOnReplies, ...replyFields(message, all), account: account.value?.email }
    fresh.baseline = fingerprint(fresh)
    return fresh
  }

  function translatedFrom(message: MessageDetail) {
    const memory = recall(message)
    return memory?.from && memory.from !== memory.to ? memory.from : undefined
  }

  function forward(message: MessageDetail) {
    start({
      subject: prefixed('Fwd', message.subject),
      ...quote(message, `---------- Forwarded message ----------\nFrom: ${formatAddress(message.from)}\nDate: ${fullDate(message.date)}\nSubject: ${message.subject}`)
    })
  }

  /** Opens a message from the Drafts folder, with its attachments, to carry on */
  async function editDraft(message: MessageDetail) {
    const attachments = await Promise.all(message.attachments.map(async (file) => {
      const blob = await $fetch<Blob>(`/api/messages/${encodeURIComponent(message.id)}/attachments/${file.index}`, { query: { folder: message.folder }, responseType: 'blob' })
      return { filename: file.filename, contentType: file.contentType, content: await blobToBase64(blob) }
    })).catch(() => undefined)
    // Opening without them would save over the only copy that has them
    if (!attachments) {
      toast.add({ title: 'Couldn’t open the draft', description: 'Its attachments didn’t download. Try again.', color: 'error', icon: 'i-lucide-circle-alert' })
      return
    }
    // Already open: the same draft twice would save over itself
    const same = /^\d+$/.test(message.id) ? stored.value.find(item => item.savedAs?.id === message.id && item.savedAs.folder === message.folder) : undefined
    if (same && !same.popped) return activate(same.id)
    start({
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      html: message.html ?? textToHtml(message.text ?? ''),
      attachments,
      signature: false,
      inReplyTo: undefined,
      savedAs: /^\d+$/.test(message.id) ? { folder: message.folder, id: message.id } : undefined
    })
  }

  /** A scheduled message taken back out to edit */
  function reopen(message: OutgoingMessage) {
    start({ ...message, cc: message.cc ?? [], bcc: message.bcc ?? [], attachments: message.attachments ?? [], signature: false })
  }

  /** Brings a draft from the dock onto the screen */
  function activate(id: string) {
    if (!find(id)) return
    if (activeId.value !== id) version.value++
    activeId.value = id
    open.value = true
  }

  /** Down to its tab; nothing is saved or lost */
  function minimise() {
    open.value = false
  }

  function remove(id: string) {
    stored.value = stored.value.filter(item => item.id !== id)
    if (activeId.value === id) {
      activeId.value = ''
      open.value = false
    }
  }

  /** Continues a draft in a window of its own */
  function popOut(id = activeId.value) {
    const target = find(id)
    if (!target) return
    target.popped = Date.now()
    if (activeId.value === id) {
      activeId.value = ''
      open.value = false
    }
    openPopout(`/compose?draft=${encodeURIComponent(id)}`)
  }

  // A pop-out says which drafts it shows, so the main window's dock leaves
  // them alone for as long as this window lives
  const held = new Set<string>()
  function hold(id: string) {
    held.add(id)
    try {
      navigator.locks?.request(draftLock(id), () => new Promise(() => {}))
    } catch {
      // No locks here: the draft goes back to the dock when this window closes
    }
  }

  /** Takes over a stored draft in this window (pages/compose.vue). False when it is gone */
  function adopt(id: string): boolean {
    const target = find(id)
    if (!target) return false
    target.popped = Date.now()
    hold(id)
    activate(id)
    return true
  }

  // A pop-out that closes with its draft unsent hands it back to the dock;
  // one nothing was written in just goes. Written straight to storage: the
  // window is gone before a watcher would run
  useEventListener(window, 'pagehide', () => {
    if (!held.size || !stored.value.some(item => held.has(item.id))) return
    try {
      const left = stored.value
        .filter(item => !held.has(item.id) || dirty(item))
        .map(item => held.has(item.id) ? { ...item, popped: undefined } : item)
      localStorage.setItem(STORE, JSON.stringify(left))
    } catch {
      // The main window takes them back itself (see reclaim)
    }
  })

  async function heldLocks(): Promise<string[] | undefined> {
    try {
      const state = await navigator.locks.query()
      return (state.held ?? []).map(lock => lock.name ?? '')
    } catch {
      return undefined
    }
  }

  // Drafts whose pop-out is gone without saying so (a crash, a blocked
  // window) come back to the dock. A window just opened gets a moment to say it is there
  async function reclaim() {
    if (standalone.value || !stored.value.some(item => item.popped)) return
    const locks = await heldLocks()
    if (!locks) return
    const lost = (item: Draft) => !!item.popped && Date.now() - item.popped > 15_000 && !locks.includes(draftLock(item.id))
    if (stored.value.some(lost)) stored.value = stored.value.map(item => lost(item) ? { ...item, popped: undefined } : item)
  }
  useEventListener(window, 'focus', reclaim)

  /** Keeps a closed draft for a while, so it can be brought back from the palette */
  function remember(kept: Draft): ClosedDraft {
    const copy: Draft = JSON.parse(JSON.stringify(kept))
    const size = copy.attachments.reduce((sum, file) => sum + file.content.length, 0)
    const droppedFiles = size > CLOSED_FILES_LIMIT ? copy.attachments.length : undefined
    if (droppedFiles) copy.attachments = []
    const entry: ClosedDraft = { id: copy.id, closedAt: Date.now(), droppedFiles, draft: copy }
    closed.value = [entry, ...closed.value.filter(item => item.id !== entry.id)].slice(0, CLOSED_KEPT)
    return entry
  }

  function forgetClosed(id: string) {
    closed.value = closed.value.filter(item => item.id !== id)
  }

  /** Reopens a recently closed draft. False when it is no longer kept */
  function reopenClosed(id: string): boolean {
    const entry = closed.value.find(item => item.id === id)
    if (!entry) return false
    forgetClosed(id)
    restore(entry.draft)
    if (entry.droppedFiles) toast.add({ title: 'Reopened without its attachments', description: 'They were too large to keep. Attach them again.', icon: 'i-lucide-paperclip' })
    return true
  }

  // Drafts on screen follow a draft saved, sent or thrown away: its old row would
  // otherwise linger and open as "couldn't open this message"
  // Taken before any await: the app context isn't there after one
  function draftsFollower() {
    const { folder, load } = useMail()
    return () => {
      if (folder.value?.role === 'drafts') load()
    }
  }

  function discard(id = activeId.value) {
    const target = find(id)
    if (!target || (sending.value && id === activeId.value)) return
    const saved = target.savedAs
    // Its copy in Drafts goes too, so the kept one must not point at it
    if (dirty(target)) remember({ ...target, savedAs: undefined })
    remove(id)
    if (saved) {
      const follow = draftsFollower()
      $fetch('/api/drafts', { method: 'DELETE', query: saved }).then(follow, () => {})
    }
  }

  // Your words, then the signature, then the original
  function outgoingHtml(from = draft.value) {
    const { html, quote } = from
    // Paragraphs sit line under line, as in every mail app; an empty one
    // keeps its height as a blank line in the recipient's client. Tables,
    // code and pictures get their looks written on them (mailReadyHtml)
    const body = mailReadyHtml(html.replace(/<p><\/p>/g, '<p><br></p>').replace(/<p>/g, '<p style="margin:0">'))
    const parts = [body]
    const signature = signatures.htmlOf(from)
    if (signature) parts.push(`<br><div class="citrusmail-signature">${mailReadyHtml(signature)}</div>`)
    if (quote) parts.push(quote)
    return parts.join('')
  }

  function outgoing(from = draft.value): OutgoingMessage {
    return {
      to: from.to,
      cc: from.cc,
      bcc: from.bcc,
      subject: from.subject,
      html: outgoingHtml(from),
      attachments: from.attachments,
      inReplyTo: from.inReplyTo,
      references: from.references,
      // Only once Settings → Tracking is set up (see mail/receipt-toggle)
      readReceipt: (trackingReady(settings.value.receipts) && (from.readReceipt ?? settings.value.receipts?.default)) || undefined
    }
  }

  /**
   * Closing with changes keeps them: the message goes to Drafts and leaves
   * the dock. Reopen brings it straight back
   */
  async function close(id = activeId.value) {
    const target = find(id)
    // Mid-send it would save a copy of a message that is about to go out
    if (!target || (sending.value && id === activeId.value)) return
    const changed = dirty(target)
    const kept: Draft = JSON.parse(JSON.stringify(target))
    remove(id)
    if (!changed) return
    const follow = draftsFollower()
    const entry = remember(kept)
    const reopenAction = { label: 'Reopen', color: 'neutral' as const, variant: 'outline' as const, onClick: () => reopenClosed(entry.id) || restore(kept) }
    pending.value++
    try {
      kept.savedAs = await $fetch<DraftRef>('/api/drafts', { method: 'POST', body: { ...outgoing(kept), replace: kept.savedAs } })
      // Reopened later, it replaces this copy instead of adding another
      closed.value = closed.value.map(item => item.id === entry.id ? { ...item, draft: { ...item.draft, savedAs: kept.savedAs } } : item)
      toast.add({ title: 'Saved to Drafts', icon: 'i-lucide-file-pen-line', actions: [reopenAction] })
      announce('Saved to Drafts')
      follow()
    } catch {
      toast.add({ title: 'Draft closed', description: 'It couldn’t be saved to Drafts.', icon: 'i-lucide-file-x', duration: 10_000, actions: [reopenAction] })
      announce('Draft closed. It couldn’t be saved to Drafts.', true)
    } finally {
      pending.value--
    }
  }

  /** Back on screen as it was, and counted as changed whatever it holds */
  function restore(kept: Draft) {
    put({ ...JSON.parse(JSON.stringify(kept)), id: newId(), baseline: '', account: account.value?.email, popped: undefined })
  }

  /** One dialog for everything worth a second look. True when the message may go */
  async function confirmGuards(target: Draft): Promise<boolean> {
    const known = [...contacts.value.map(contact => contact.name), ...Object.values(tally.value).flatMap(stat => stat.name ? [stat.name] : [])]
    const issues = composeGuards({
      subject: target.subject,
      text: plainText(target.html),
      // A picture placed in the message is what "attached" often means
      attachments: target.attachments.length + (target.html.match(/<img/gi)?.length ?? 0),
      recipients: [...target.to, ...target.cc, ...target.bcc],
      knownNames: known
    })
    if (!issues.length) return true
    const dialog = overlay.create(MailComposerGuardDialog, { destroyOnClose: true, props: { issues } })
    return !!(await dialog.open().result)
  }

  /** Seconds a sent message is held back so it can be undone; 0 sends at once */
  function undoSeconds(): number {
    return Math.max(0, Number(prefs.value.undoSend) || 0)
  }

  /** What goes to the send endpoint, kept whole so a held message can still go out */
  interface Outbound {
    body: { message: OutgoingMessage, sendAt?: string, draft?: DraftRef }
    kept: Draft
    people: Address[]
    follow: () => void
  }

  // Hands a message to the server and says how it went. A message that
  // can't be sent comes back to the dock rather than being lost
  async function dispatch({ body, kept, people, follow }: Outbound, scheduled: boolean): Promise<boolean> {
    sending.value = true
    // The taskbar and Dock have no "busy" look: half full until it's done
    desktop()?.setProgress(0.5)
    try {
      const result = await $fetch<{ scheduled?: ScheduledMessage }>('/api/send', { method: 'POST', body })
      tally.value = recordRecipients(tally.value, people)
      if (kept.savedAs) follow()
      if (result.scheduled) {
        tellWindows({ type: 'scheduled:changed' })
        await refreshScheduled()
        toast.add({ title: `Scheduled for ${scheduleLabel(result.scheduled.sendAt)}`, icon: 'i-lucide-clock-arrow-up', actions: [{ label: 'View', color: 'neutral', variant: 'outline', to: draftsLink.value }] })
        announce(`Scheduled for ${scheduleLabel(result.scheduled.sendAt)}`)
      } else {
        toast.add({ title: 'Message sent', icon: 'i-lucide-send', color: 'success' })
        playUiSound('send')
        announce('Message sent')
      }
      return true
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: scheduled ? 'Message not scheduled' : 'Message not sent', description: message ?? 'Check your connection and try again.', color: 'error', icon: 'i-lucide-circle-alert' })
      // Kept in the notification centre too, so a send that failed while you looked away isn't missed
      useNotificationCentre().push({ kind: 'failed', title: scheduled ? 'Message not scheduled' : 'Message not sent', body: `${kept.subject.trim() || '(No subject)'}${message ? ` · ${message}` : ''}`, key: `failed:${kept.id}` })
      announce(scheduled ? 'Message not scheduled' : 'Message not sent', true)
      return false
    } finally {
      sending.value = false
      desktop()?.setProgress(-1)
    }
  }

  // Undo send. The message is held here, not on the server, for the seconds
  // set in Settings → Reading, and only then handed over: Undo is a matter of
  // not sending it. Held messages that the window closes on still go out
  // (or, when too large to send from a closing page, wait in the dock)
  const waiting = new Map<string, { out: Outbound, timer: ReturnType<typeof setTimeout> }>()

  function holdBack(out: Outbound, seconds: number) {
    const id = `undo-send-${newId()}`
    const settle = () => {
      if (!waiting.delete(id)) return false
      pending.value--
      return true
    }
    pending.value++
    waiting.set(id, {
      out,
      timer: setTimeout(async () => {
        if (!settle()) return
        toast.remove(id)
        // Not sent after all: the draft goes back where it can be tried again
        if (!(await dispatch(out, false))) restore(out.kept)
      }, seconds * 1000)
    })
    toast.add({
      id,
      title: 'Sending…',
      description: `${out.kept.subject.trim() || '(No subject)'} goes out in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
      icon: 'i-lucide-send',
      duration: seconds * 1000,
      actions: [{
        label: 'Undo',
        icon: 'i-lucide-undo-2',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          const entry = waiting.get(id)
          if (!entry || !settle()) return
          clearTimeout(entry.timer)
          toast.remove(id)
          restore(out.kept)
          toast.add({ title: 'Sending undone', description: 'Your message is back in the composer.', icon: 'i-lucide-undo-2' })
          playUiSound('undo')
          announce('Sending undone. Your message is back in the composer.')
        }
      }]
    })
    announce(`Sending in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}. Undo is in the notification.`)
  }

  // A request made while the page closes can only carry a little. A held
  // message that fits is sent on the way out; a larger one (attachments)
  // is written back to the dock, where the next launch restores it
  const KEEPALIVE_LIMIT = 60_000
  useEventListener(window, 'pagehide', () => {
    const back: Draft[] = []
    for (const [id, { out, timer }] of waiting) {
      clearTimeout(timer)
      waiting.delete(id)
      const body = JSON.stringify(out.body)
      if (body.length <= KEEPALIVE_LIMIT) {
        fetch('/api/send', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body }).catch(() => {})
      } else {
        back.push({ ...JSON.parse(JSON.stringify(out.kept)), id: newId(), baseline: '', account: account.value?.email, popped: undefined })
      }
    }
    if (!back.length) return
    try {
      // Written straight to storage: the watcher that normally does it won't run again
      localStorage.setItem(STORE, JSON.stringify([...stored.value, ...back]))
    } catch {
      // Storage is full or off: nothing more can be done from a closing page
    }
  })

  let asking = false

  /**
   * Sends a draft, whether it is in the dock or not: the checks, the undo
   * time, the toasts. True once the message is on its way
   */
  async function deliver(target: Draft, sendAt?: Date): Promise<boolean> {
    const people = [...target.to, ...target.cc, ...target.bcc]
    if (!people.length) {
      toast.add({ title: 'Add someone to send this to', color: 'warning', icon: 'i-lucide-user-plus' })
      return false
    }
    // A second press while the first is still asking or sending
    if (sending.value || asking) return false
    const follow = draftsFollower()
    asking = true
    const confirmed = await confirmGuards(target).finally(() => (asking = false))
    if (!confirmed) return false

    const out: Outbound = {
      body: { message: outgoing(target), sendAt: sendAt?.toISOString(), draft: target.savedAs },
      kept: JSON.parse(JSON.stringify(target)),
      people,
      follow
    }
    const undo = sendAt ? 0 : undoSeconds()
    if (undo) {
      remove(target.id)
      holdBack(out, undo)
      return true
    }
    const sent = await dispatch(out, !!sendAt)
    if (sent) remove(target.id)
    return sent
  }

  /** Sends the draft on screen: now (with the undo time, if set) or at `sendAt` */
  async function send(sendAt?: Date) {
    if (active.value) await deliver(active.value, sendAt)
  }

  async function attach(files: File[]) {
    const read = async (file: File): Promise<OutgoingAttachment> => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      content: await blobToBase64(file)
    })

    const target = draft.value
    const added = await Promise.all(files.map(read))
    const size = [...target.attachments, ...added].reduce((sum, file) => sum + file.content.length * 0.75, 0)
    if (size > 25 * 1024 * 1024) {
      toast.add({ title: 'Attachments are over 25 MB', description: 'Most mail servers refuse messages that large.', color: 'warning', icon: 'i-lucide-paperclip' })
      return
    }
    target.attachments = [...target.attachments, ...added]
  }

  function detach(index: number) {
    draft.value.attachments = draft.value.attachments.filter((_, i) => i !== index)
  }

  // True when the app has just been started, rather than this window reloaded
  // or a second main window opened beside one that is already running
  async function freshLaunch(): Promise<boolean> {
    const session = useSessionStorage('citrusmail-composer-session', false)
    const reloaded = session.value
    session.value = true
    const others = (await heldLocks())?.includes(WINDOW_LOCK) ?? false
    try {
      navigator.locks?.request(WINDOW_LOCK, { mode: 'shared' }, () => new Promise(() => {}))
    } catch {
      // No locks here: every start of a main window then counts as a launch
    }
    return !reloaded && !others
  }

  // After a restart (or a crash) what was being written is back in the dock.
  // A reload keeps the composer exactly as it was, through session storage.
  // Only the main window speaks for the app; pop-outs and panes follow it
  onNuxtReady(async () => {
    if (standalone.value || windowKind() !== 'main') return
    if (!(await freshLaunch())) return
    await reclaim()
    // Untouched messages left open aren't worth bringing back
    const kept = stored.value.filter(dirty)
    if (kept.length !== stored.value.length) stored.value = kept
    const restored = kept.filter(mine)
    if (!restored.length) return
    toast.add({
      title: restored.length === 1 ? 'Restored 1 draft' : `Restored ${restored.length} drafts`,
      description: restored.length === 1 ? 'It’s waiting at the bottom of the window.' : 'They’re waiting at the bottom of the window.',
      icon: 'i-lucide-archive-arrow-up',
      duration: 10_000,
      actions: [{ label: 'Discard', color: 'neutral', variant: 'outline', onClick: () => restored.forEach(item => discard(item.id)) }]
    })
  })

  defineAppShortcuts({
    'mail.compose': () => compose(),
    'compose.send': {
      usingInput: true,
      // Only from inside the composer: the quick reply under a message has the same keys
      handler: () => {
        if (open.value && !sending.value && document.activeElement?.closest('[data-composer]')) send()
      }
    }
  })

  return {
    open, sending, draft, version, isDirty, editor, focusBody, start, compose, reply, forward, editDraft, reopen, close, discard, send, attach, detach,
    drafts, activeId, hasDraft, standalone, pending, closed, activate, minimise, popOut, adopt, restore, reopenClosed, forgetClosed, composeFromMailto, replyDraft, deliver
  }
}

export const useComposer = createAppComposable(_useComposer)

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** "tomorrow at 8:00" or "Mon 12 Jan at 8:00" */
export function scheduleLabel(iso: string) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return `today at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`
}
