import type { Insights } from '~/utils/insights'

/** How many pages of each folder are read: enough for a month of most mailboxes, gentle on the mail server */
const PAGES = 4
const KEEP_FOR = 30 * 60_000

interface Loaded {
  messages: MessageSummary[]
  /** There was more in the folder than was read */
  more: boolean
}

interface Snapshot {
  mailbox: string
  at: number
  insights: Insights
  inbox: number
  sent: number
  /** The oldest message read from a folder that had more: days before it are not fully counted */
  since?: Date
  /** This mailbox has no Sent folder the app could find */
  noSent: boolean
}

// Settings → Insights. Reads the Inbox and Sent lists the way the mail page
// does, one page after another, and keeps the result for half an hour so
// coming back to the tab asks the mail server for nothing
const _useInsights = () => {
  const { account } = useShell()
  const { folders } = useMail()
  const snapshot = shallowRef<Snapshot>()
  const loading = ref(false)
  const failed = ref(false)
  /** Pages read so far, out of `total`, for the progress line */
  const progress = ref({ done: 0, total: PAGES * 2 })

  async function read(folder: string): Promise<Loaded> {
    const messages: MessageSummary[] = []
    let before: string | undefined
    for (let page = 0; page < PAGES; page++) {
      const result = await $fetch<MessagePage>('/api/messages', { query: { folder, before } })
      messages.push(...result.messages)
      progress.value = { ...progress.value, done: progress.value.done + 1 }
      before = result.cursor
      if (!before) return { messages, more: false }
    }
    return { messages, more: true }
  }

  const oldest = (loaded: Loaded) => loaded.more
    ? loaded.messages.reduce<number | undefined>((min, message) => {
        const at = Date.parse(message.date)
        return Number.isNaN(at) || (min !== undefined && min <= at) ? min : at
      }, undefined)
    : undefined

  async function load(force = false) {
    const mailbox = account.value?.email ?? ''
    if (!mailbox || loading.value) return
    const fresh = snapshot.value?.mailbox === mailbox && Date.now() - snapshot.value.at < KEEP_FOR
    if (fresh && !force) return
    loading.value = true
    failed.value = false
    progress.value = { done: 0, total: PAGES * 2 }
    try {
      // Straight after launch the folder list may still be on its way; without it Sent can't be found
      if (!folders.value.length) await until(() => folders.value.length > 0).toBe(true, { timeout: 5000 })
      const inboxPath = folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
      const sentPath = folders.value.find(folder => folder.role === 'sent')?.path
      const inbox = await read(inboxPath)
      const sent = sentPath ? await read(sentPath) : { messages: [], more: false }
      const cut = [oldest(inbox), oldest(sent)].filter((at): at is number => at !== undefined)
      snapshot.value = {
        mailbox,
        at: Date.now(),
        insights: computeInsights(inbox.messages, sent.messages),
        inbox: inbox.messages.length,
        sent: sent.messages.length,
        // The later of the two: from there on both folders were read in full
        since: cut.length ? new Date(Math.max(...cut)) : undefined,
        noSent: !sentPath
      }
    } catch {
      failed.value = true
    } finally {
      loading.value = false
    }
  }

  /** Only ever the open mailbox's numbers */
  const current = computed(() => snapshot.value?.mailbox === account.value?.email ? snapshot.value : undefined)

  return { snapshot: current, loading, failed, progress, load }
}

export const useInsights = createAppComposable(_useInsights)
