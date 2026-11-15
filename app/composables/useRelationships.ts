/** Pages of each folder read: the same as Settings → Insights, gentle on the mail server */
const PAGES = 4
const KEEP_FOR = 30 * 60_000

interface Loaded {
  messages: MessageSummary[]
  more: boolean
}

interface Snapshot {
  mailbox: string
  at: number
  inbox: MessageSummary[]
  sent: MessageSummary[]
  /** There was more in a folder than was read */
  partial: boolean
  /** The oldest message read, ms since epoch */
  since?: number
  noSent: boolean
}

// Contacts → Relationships. Reads the Inbox and Sent lists one page after
// another and keeps them for half an hour, so going back and forth between
// a contact and this page asks the mail server for nothing. The sums are
// worked out again from the kept lists whenever the address book changes
const _useRelationships = () => {
  const { account } = useShell()
  const { folders } = useMail()
  const { contacts } = useContacts()

  const snapshot = shallowRef<Snapshot>()
  const loading = ref(false)
  const failed = ref(false)
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

  async function load(force = false) {
    const mailbox = account.value?.email ?? ''
    if (!mailbox || loading.value) return
    const fresh = snapshot.value?.mailbox === mailbox && Date.now() - snapshot.value.at < KEEP_FOR
    if (fresh && !force) return

    loading.value = true
    failed.value = false
    progress.value = { done: 0, total: PAGES * 2 }
    announce('Reading your mail')
    try {
      // Straight after launch the folder list may still be on its way; without it Sent can't be found
      if (!folders.value.length) await until(() => folders.value.length > 0).toBe(true, { timeout: 5000 })
      const inboxPath = folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
      const sentPath = folders.value.find(folder => folder.role === 'sent')?.path
      const inbox = await read(inboxPath)
      const sent = sentPath ? await read(sentPath) : { messages: [], more: false }
      const dates = [...inbox.messages, ...sent.messages].map(message => Date.parse(message.date)).filter(at => !Number.isNaN(at))
      snapshot.value = {
        mailbox,
        at: Date.now(),
        inbox: inbox.messages,
        sent: sent.messages,
        partial: inbox.more || sent.more,
        since: dates.length ? Math.min(...dates) : undefined,
        noSent: !sentPath
      }
      announce('Relationships updated')
    } catch {
      failed.value = true
      announce('Couldn’t read your mail', true)
    } finally {
      loading.value = false
    }
  }

  const current = computed(() => snapshot.value?.mailbox === account.value?.email ? snapshot.value : undefined)

  // Every address of a contact counts as that contact, filed under the first
  const byAddress = computed(() => {
    const map = new Map<string, Contact>()
    for (const contact of contacts.value) {
      for (const email of contact.emails) {
        const key = email.trim().toLowerCase()
        if (key && !map.has(key)) map.set(key, contact)
      }
    }
    return map
  })

  const result = computed(() => {
    const data = current.value
    if (!data) return undefined
    return computeRelationships(data.inbox, data.sent, {
      self: [account.value?.email ?? '', ...(account.value?.mailboxes?.map(mailbox => mailbox.email) ?? [])],
      canonical: address => byAddress.value.get(address)?.emails[0]?.trim().toLowerCase() ?? address,
      known: address => byAddress.value.has(address)
    })
  })

  const contactFor = (address: string) => byAddress.value.get(address.toLowerCase())

  return { snapshot: current, result, loading, failed, progress, load, contactFor }
}

export const useRelationships = createAppComposable(_useRelationships)
