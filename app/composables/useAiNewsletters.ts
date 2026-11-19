import type { NewsletterFacts } from '~/utils/ai-triage'

const WEEK = 7 * 24 * 60 * 60 * 1000
/** Lists described in one prompt, most frequent first */
const MOST = 60

interface NewsletterRun {
  /** When the advice was asked for, ISO */
  at: string
  advice: AiNewsletterAdvice[]
  /** Ones you waved away */
  dismissed?: string[]
}

// The newsletter advisor: which lists you might leave, and why, from how
// often each writes and how much of its mail in the Inbox is still unread.
// It runs by itself at most once a week, when the Subscriptions page opens,
// and again whenever you ask
const _useAiNewsletters = () => {
  const ai = useAiClient()
  const { settings } = useSettings()
  const { folders } = useMail()
  const last = useAccountPref<NewsletterRun>('ai-newsletters', () => ({ at: '', advice: [] }))
  const status = ref<'idle' | 'asking' | 'error'>('idle')
  const error = ref('')

  const on = computed(() => ai.enabled('newsletters'))
  const due = computed(() => !last.value.at || Date.now() - new Date(last.value.at).getTime() > WEEK)
  const advice = computed(() => last.value.advice.filter(item => !last.value.dismissed?.includes(item.address)))

  /**
   * Per sender, how much of the Inbox's newest page is theirs and unread.
   * Only the newest page: it's a rough sign of what you don't open, and
   * the page says so
   */
  async function inboxCounts() {
    const inbox = folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
    const page = await $fetch<MessagePage>('/api/messages', { query: { folder: inbox } }).catch(() => undefined)
    const counts = new Map<string, { inInbox: number, unread: number }>()
    for (const message of page?.messages ?? []) {
      const address = message.from.address.toLowerCase()
      const entry = counts.get(address) ?? { inInbox: 0, unread: 0 }
      counts.set(address, { inInbox: entry.inInbox + 1, unread: entry.unread + (message.unread ? 1 : 0) })
    }
    return counts
  }

  const counts = shallowRef(new Map<string, { inInbox: number, unread: number }>())

  /** Asks for advice on the lists you haven't left yet. `background` when it ran by itself */
  async function run(subscriptions: Subscription[], background = false) {
    if (status.value === 'asking' || !on.value) return
    const open = subscriptions.filter(item => !item.unsubscribedAt).sort((a, b) => b.count - a.count).slice(0, MOST)
    if (!open.length) return
    status.value = 'asking'
    error.value = ''
    try {
      counts.value = await inboxCounts()
      const facts: NewsletterFacts[] = open.map(item => ({ name: item.name, address: item.address, count: item.count, lastDate: item.lastDate, ...(counts.value.get(item.address.toLowerCase()) ?? { inInbox: 0, unread: 0 }) }))
      const answer = await ai.json({
        feature: 'newsletters',
        system: newsletterSystem(languageName(settings.value.language || 'en')),
        prompt: newsletterPrompt(facts),
        maxTokens: 900,
        effort: 'low',
        background
      }, newsletterAnswer)
      const found = readNewsletters(answer, facts.length)
      last.value = { at: new Date().toISOString(), advice: found.map(item => ({ address: open[item.index]!.address, reason: item.reason })) }
      status.value = 'idle'
      if (!background) announce(found.length ? `${found.length} ${found.length === 1 ? 'suggestion' : 'suggestions'} to unsubscribe` : 'No lists stand out to leave')
    } catch (failure) {
      status.value = 'error'
      error.value = (failure as Error).message || 'The AI didn’t answer.'
      if (!background) announce(`Couldn’t get suggestions. ${error.value}`, true)
    }
  }

  /** Opening the page: runs by itself only when the last advice is over a week old */
  function maybeRun(subscriptions: Subscription[]) {
    if (on.value && due.value && subscriptions.some(item => !item.unsubscribedAt)) run(subscriptions, true)
  }

  function dismiss(address: string) {
    last.value = { ...last.value, dismissed: [...(last.value.dismissed ?? []), address] }
    announce('Suggestion dismissed')
  }

  /** How much of a list's mail in the Inbox is unread, for the page to show */
  const unreadOf = (address: string) => counts.value.get(address.toLowerCase())

  return { on, last, advice, due, status, error, run, maybeRun, dismiss, unreadOf, refreshCounts: async () => (counts.value = await inboxCounts()) }
}

export const useAiNewsletters = createAppComposable(_useAiNewsletters)
