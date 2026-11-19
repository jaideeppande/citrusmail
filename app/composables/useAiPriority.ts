/** Verdicts kept per mailbox; the oldest go first past this */
const KEEP = 1500
/** Corrections remembered, and how many of the latest teach each prompt */
const CORRECTIONS = 40
const TEACH = 8

// The priority inbox: what each new Inbox message asks of you (a reply, an
// action, nothing), sorted by AI in the background, one request per batch.
// You can correct it from a row's menu; corrections are remembered and shown
// to the model as examples, so it learns your taste
const _useAiPriority = () => {
  const ai = useAiClient()
  const { settings } = useSettings()
  const { account } = useShell()
  const mail = useMail()
  const results = useAccountPref<Record<string, AiPriorityResult>>('ai-priority', () => ({}))
  const corrections = useAccountPref<AiPriorityCorrection[]>('ai-priority-corrections', () => [])
  /** The list header's "Needs you" filter, for this window */
  const needsYou = ref(false)

  const on = computed(() => ai.enabled('priority'))
  const inInbox = computed(() => mail.folder.value?.role === 'inbox' || mail.folder.value?.path === 'INBOX')
  // The filter belongs to the Inbox: leaving it, or the feature going off, ends it
  watch([inInbox, on], ([inbox, enabled]) => {
    if (!inbox || !enabled) needsYou.value = false
  })

  const of = (message: MessageSummary) => results.value[labelKey(message)]

  /**
   * What a row shows: the most pressing verdict among the conversation's
   * messages, and only one that asks something of you
   */
  function rowTag(message: MessageSummary): AiPriorityResult | undefined {
    if (!on.value) return undefined
    const order: AiPriorityKind[] = ['urgent', 'reply', 'act']
    let best: AiPriorityResult | undefined
    for (const item of mail.thread(message)) {
      const found = of(item)
      if (found && needsReader(found.kind) && (!best || order.indexOf(found.kind) < order.indexOf(best.kind))) best = found
    }
    return best
  }

  const needsYouRow = (message: MessageSummary) => !!rowTag(message)

  function save(next: Record<string, AiPriorityResult>) {
    const entries = Object.entries(next)
    results.value = entries.length > KEEP ? Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, KEEP)) : next
  }

  /** You set it yourself: kept, and taught to the next prompts */
  function correct(message: MessageSummary, kind: AiPriorityKind) {
    const next = { ...results.value }
    for (const item of mail.thread(message)) {
      // Only the messages the row is tagged for, or the row's own, change
      if (item !== message && !needsReader(of(item)?.kind)) continue
      next[labelKey(item)] = { kind, reason: 'You set this', corrected: true, at: Date.now() }
    }
    save(next)
    corrections.value = [
      { from: message.from.address.toLowerCase(), subject: message.subject.slice(0, 120), kind, at: Date.now() },
      ...corrections.value.filter(item => !(item.from === message.from.address.toLowerCase() && item.subject === message.subject.slice(0, 120)))
    ].slice(0, CORRECTIONS)
    announce(needsReader(kind) ? `Marked ${PRIORITY_INFO[kind].label.toLowerCase()}` : 'Marked not important')
  }

  /** The background worker: one request for the batch */
  async function classify(messages: MessageSummary[]) {
    // A message you sorted yourself is never asked about again
    const asked = messages.filter(message => !of(message)?.corrected)
    if (!asked.length) return
    const language = languageName(settings.value.language || 'en')
    const answer = await ai.json({
      feature: 'priority',
      system: prioritySystem(language, account.value?.email),
      prompt: priorityPrompt(asked, corrections.value.slice(0, TEACH)),
      maxTokens: 200 + asked.length * 80,
      effort: 'low',
      background: true
    }, priorityAnswer)
    const found = readPriority(answer, asked.length)
    const next = { ...results.value }
    const now = Date.now()
    asked.forEach((message, index) => {
      const verdict = found.get(index)
      if (verdict) next[labelKey(message)] = { ...verdict, at: now }
    })
    save(next)
  }

  return { results, corrections, needsYou, on, inInbox, of, rowTag, needsYouRow, correct, classify }
}

export const useAiPriority = createAppComposable(_useAiPriority)
