import type { InboxTab } from '~/utils/threads'

const LISTS_FRESH = 6 * 3_600_000

// The Inbox split into tabs, and the Screen queue for people who have never
// written before. Both are a way of looking at the same Inbox: nothing moves
// on the server, so turning either off puts every message back in one list
const _useInboxTabs = () => {
  const prefs = usePrefs()
  const { account } = useShell()
  const { lists: senders, allow, block } = useSenders()
  const { contacts } = useContacts()

  const tab = ref<InboxTab>('people')
  const enabled = computed(() => prefs.value.splitInbox || prefs.value.screening)

  // The addresses of the mailing lists in the Inbox, which the subscriptions
  // check already works out. It reads a lot of mail, so it's asked for at
  // most every few hours and remembered here in between
  const lists = useAccountPref<{ at: number, addresses: string[] }>('lists', () => ({ at: 0, addresses: [] }))
  const listSet = computed(() => new Set(lists.value.addresses))
  async function refreshLists() {
    if (!prefs.value.splitInbox || !account.value || account.value.protocol === 'pop3' || Date.now() - lists.value.at < LISTS_FRESH) return
    const found = await $fetch<Subscription[]>('/api/subscriptions').catch(() => undefined)
    if (found) lists.value = { at: Date.now(), addresses: found.map(item => item.address.toLowerCase()) }
  }
  watch(() => [prefs.value.splitInbox, account.value?.email], refreshLists, { immediate: true })

  // People you've let through Screen without putting them on the allow list
  const screened = useAccountPref<string[]>('screened', () => [])
  // Who you've written to, kept by the composer: someone you mailed first is no stranger
  const written = useAccountPref<Record<string, unknown>>('recipients', () => ({}))

  const known = computed(() => {
    const set = new Set<string>(screened.value)
    for (const contact of contacts.value) for (const email of contact.emails) set.add(email.toLowerCase())
    for (const address of Object.keys(written.value)) set.add(address.toLowerCase())
    if (account.value) set.add(account.value.email.toLowerCase())
    return set
  })

  /** Someone new: not a contact, never written to, not on a list of yours */
  function isStranger(message: MessageSummary) {
    const from = message.from.address.toLowerCase()
    return !known.value.has(from) && !senderOnList(senders.value.allowed, from) && !listSet.value.has(from) && !isMachineSender(from)
  }

  function categoryOf(message: MessageSummary): InboxTab {
    if (prefs.value.screening && isStranger(message)) return 'screen'
    return prefs.value.splitInbox ? inboxCategory(message, listSet.value) : 'people'
  }

  const accepts = (message: MessageSummary) => categoryOf(message) === tab.value

  function counts(messages: MessageSummary[]) {
    const unread: Record<InboxTab, number> = { people: 0, newsletters: 0, notifications: 0, tracked: 0, screen: 0 }
    const total = { ...unread }
    for (const message of messages) {
      const category = categoryOf(message)
      total[category]++
      if (message.unread) unread[category]++
    }
    return { unread, total }
  }

  const tabs = computed(() => {
    const items: { value: InboxTab, label: string, icon: string }[] = []
    if (prefs.value.splitInbox) {
      items.push(
        { value: 'people', label: 'People', icon: 'i-lucide-users-round' },
        { value: 'newsletters', label: 'Newsletters', icon: 'i-lucide-newspaper' },
        { value: 'notifications', label: 'Notifications', icon: 'i-lucide-bell' },
        { value: 'tracked', label: 'Tracked', icon: 'i-lucide-mail-check' }
      )
    } else {
      items.push({ value: 'people', label: 'Inbox', icon: 'i-lucide-inbox' })
    }
    if (prefs.value.screening) items.push({ value: 'screen', label: 'Screen', icon: 'i-lucide-user-round-search' })
    return items
  })

  // A tab that was switched off is no place to be left on
  watch(tabs, (items) => {
    if (!items.some(item => item.value === tab.value)) tab.value = 'people'
  })

  /** Lets a new sender through: on your allow list, so their pictures show too */
  async function accept(message: MessageSummary) {
    const from = message.from.address.toLowerCase()
    screened.value = [...new Set([...screened.value, from])]
    await allow(from)
  }

  /** Lets one through for now without allowing them for good */
  function acceptOnce(message: MessageSummary) {
    screened.value = [...new Set([...screened.value, message.from.address.toLowerCase()])]
  }

  const reject = (message: MessageSummary) => block(message.from.address.toLowerCase())

  return { tab, tabs, enabled, categoryOf, accepts, counts, isStranger, accept, acceptOnce, reject }
}

export const useInboxTabs = createAppComposable(_useInboxTabs)
