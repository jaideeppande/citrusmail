const KEEP = 1500

// The scam and phishing check. Cheap checks run here first (a brand name on
// someone else's address, payment pressure, links that lie about where they
// go), and go to the AI with the message as evidence; the AI makes the call.
// Results are kept per message on this computer
const _useAiScam = () => {
  const ai = useAiClient()
  const { settings } = useSettings()
  const cache = useMessageCache()
  const senders = useSenders()
  const { contacts } = useContacts()
  const mail = useMail()
  const results = useAccountPref<Record<string, AiScamResult>>('ai-scam', () => ({}))

  const on = computed(() => ai.enabled('scam'))
  const known = computed(() => new Set(contacts.value.flatMap(contact => contact.emails.map(email => email.toLowerCase()))))

  const of = (message: MessageSummary) => results.value[labelKey(message)]

  /** A warning worth showing: not safe, not waved through by you */
  function warning(message: MessageSummary): AiScamResult | undefined {
    if (!on.value) return undefined
    const found = of(message)
    return found && found.verdict !== 'safe' && !found.dismissed ? found : undefined
  }

  /** A row stands for its conversation: the worst warning among its messages */
  function rowWarning(message: MessageSummary) {
    let worst: AiScamResult | undefined
    for (const item of mail.thread(message)) {
      const found = warning(item)
      if (found && (!worst || found.verdict === 'dangerous')) worst = found
    }
    return worst
  }

  function save(next: Record<string, AiScamResult>) {
    const entries = Object.entries(next)
    results.value = entries.length > KEEP ? Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, KEEP)) : next
  }

  /** "This looks safe": no warning for this message again */
  function dismiss(message: MessageSummary) {
    const found = of(message)
    if (!found) return
    save({ ...results.value, [labelKey(message)]: { ...found, dismissed: true } })
    announce('Marked as safe')
  }

  /** Goes through the usual move, so Undo works */
  function junk(message: MessageSummary) {
    return mail.moveMany([message], 'junk')
  }

  /**
   * Senders you've vouched for are never checked: they're on your allow
   * list, or in your contacts. The AI isn't asked about them at all, which
   * also saves the cost
   */
  const trusted = (message: MessageSummary) => senders.isAllowed(message.from.address) || known.value.has(message.from.address.toLowerCase())

  /** The background worker: local checks, then one request for the batch */
  async function check(messages: MessageSummary[]) {
    const asked = messages.filter(message => !trusted(message) && !of(message)?.dismissed)
    if (!asked.length) return
    const withSignals = await Promise.all(asked.map(async (message) => {
      const signals = [...senderSignals(message.from), ...textSignals(message)]
      // Links need the message itself: fetched (without marking it read) only when something already looks off
      if (signals.length) {
        const detail = await cache.peek(message.folder, message.id).then(entry => entry.message).catch(() => undefined)
        if (detail?.html) signals.push(...linkSignals(detail.html))
      }
      return { ...message, signals }
    }))
    const answer = await ai.json({
      feature: 'scam',
      system: scamSystem(languageName(settings.value.language || 'en')),
      prompt: scamPrompt(withSignals),
      maxTokens: 150 + asked.length * 90,
      effort: 'low',
      background: true
    }, scamAnswer)
    const found = readScam(answer, asked.length)
    const next = { ...results.value }
    const now = Date.now()
    asked.forEach((message, index) => {
      const verdict = found.get(index)
      if (verdict) next[labelKey(message)] = { ...verdict, at: now }
    })
    save(next)
  }

  return { results, on, of, warning, rowWarning, dismiss, junk, trusted, check }
}

export const useAiScam = createAppComposable(_useAiScam)

/** How a warning reads and looks, for rows and the banner alike */
export const scamLook = (verdict: AiScamVerdict) => verdict === 'dangerous'
  ? { label: 'Likely a scam', icon: 'i-lucide-shield-x', color: 'error' as const }
  : { label: 'Possibly a scam', icon: 'i-lucide-shield-alert', color: 'warning' as const }
