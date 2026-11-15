import type { MailLabel } from '~/utils/labels'

const KEEP = 1500

interface StoredSuggestions {
  ids: AiLabelSuggestion[]
  /** Ones you waved away, never shown again for this message */
  dismissed?: string[]
  at: number
}

// Suggested labels: the AI reads each new message with your label names and
// a few examples of each, and suggests up to two it's confident about. They
// show as dashed chips that apply with one click, or go away with another
const _useAiLabels = () => {
  const ai = useAiClient()
  const labels = useLabels()
  const mail = useMail()
  const stored = useAccountPref<Record<string, StoredSuggestions>>('ai-labels', () => ({}))

  const on = computed(() => ai.enabled('suggest-labels') && labels.labels.value.length > 0)

  /** What's still worth suggesting: labels that exist, aren't on it yet and weren't dismissed */
  function suggestionsOf(message: MessageSummary): MailLabel[] {
    if (!on.value) return []
    const entry = stored.value[labelKey(message)]
    if (!entry) return []
    return entry.ids
      .filter(item => !entry.dismissed?.includes(item.id) && !labels.has(message, item.id))
      .map(item => labels.labels.value.find(label => label.id === item.id))
      .filter((label): label is MailLabel => !!label)
  }

  function save(next: Record<string, StoredSuggestions>) {
    const entries = Object.entries(next)
    stored.value = entries.length > KEEP ? Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, KEEP)) : next
  }

  /** Puts the label on (through the usual toggle, which announces it) */
  function apply(message: MessageSummary, id: string) {
    if (!labels.has(message, id)) labels.toggle([message], id)
  }

  function dismiss(message: MessageSummary, id: string) {
    const key = labelKey(message)
    const entry = stored.value[key]
    if (!entry) return
    save({ ...stored.value, [key]: { ...entry, dismissed: [...(entry.dismissed ?? []), id] } })
    const name = labels.labels.value.find(label => label.id === id)?.name
    announce(name ? `Dismissed suggested label ${name}` : 'Suggestion dismissed')
  }

  /** Every message with suggestions among `messages` */
  const withSuggestions = (messages: MessageSummary[]) => messages.filter(message => suggestionsOf(message).length)

  /** Applies every suggestion on the given messages, one label at a time so each is announced once */
  function applyAll(messages: MessageSummary[]) {
    const byLabel = new Map<string, MessageSummary[]>()
    for (const message of messages) {
      for (const label of suggestionsOf(message)) byLabel.set(label.id, [...(byLabel.get(label.id) ?? []), message])
    }
    if (!byLabel.size) return announce('No suggested labels to apply')
    for (const [id, list] of byLabel) labels.toggle(list, id)
  }

  /** A few subjects per label: the ones remembered when it was put on, then any in the open folder */
  function examples(id: string) {
    const remembered = labels.examplesOf(id)
    if (remembered.length >= 3) return remembered
    const loaded = mail.messages.value.filter(message => labels.has(message, id)).map(message => message.subject).filter(Boolean)
    return [...new Set([...remembered, ...loaded])].slice(0, 3)
  }

  /** The background worker: one request for the batch, only when you have labels */
  async function suggest(messages: MessageSummary[]) {
    if (!labels.labels.value.length) return
    const asked = messages.filter(message => !stored.value[labelKey(message)])
    if (!asked.length) return
    const list = labels.labels.value.map(label => ({ id: label.id, name: label.name, examples: examples(label.id) }))
    const answer = await ai.json({
      feature: 'suggest-labels',
      system: labelSystem,
      prompt: labelPrompt(asked, list),
      maxTokens: 100 + asked.length * 50,
      effort: 'low',
      background: true
    }, labelAnswer)
    const found = readLabels(answer, asked.length, list.map(label => label.id))
    const next = { ...stored.value }
    const now = Date.now()
    asked.forEach((message, index) => {
      const ids = found.get(index)
      // An empty answer is kept too, so the message isn't asked about again
      if (ids) next[labelKey(message)] = { ids, at: now }
    })
    save(next)
  }

  return { on, suggestionsOf, withSuggestions, apply, dismiss, applyAll, suggest }
}

export const useAiLabels = createAppComposable(_useAiLabels)
