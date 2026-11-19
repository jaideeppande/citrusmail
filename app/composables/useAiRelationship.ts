/** How long a summary is kept before it reads as stale */
const KEEP_FOR = 7 * 86_400_000
const MAX_MESSAGES = 15
const FULL_BODIES = 3
/** Summaries kept on this computer */
const KEEP = 100

interface StoredSummary {
  at: number
  text: string
  /** How many messages it was written from */
  count: number
}

/** The person a summary is about: a contact, or an address from the Relationships page */
export interface RelationshipPerson {
  name: string
  emails: string[]
}

/**
 * A few sentences on your history with one person: what you write about,
 * the tone lately, anything still open. Written from the newest mail both
 * ways, on a click, and kept for a week per person
 */
export function useAiRelationship(person: MaybeRefOrGetter<RelationshipPerson>) {
  const ai = useAiClient()
  const { folders } = useMail()

  const stored = useAccountPref<Record<string, StoredSummary>>('ai-relationship', () => ({}))
  const on = computed(() => ai.enabled('relationship'))
  const key = computed(() => toValue(person).emails[0]?.trim().toLowerCase() ?? '')
  const summary = computed(() => {
    const entry = stored.value[key.value]
    return entry && Date.now() - entry.at < KEEP_FOR ? entry : undefined
  })

  const busy = ref(false)
  const error = ref('')
  /** The answer as it comes in, before it is kept */
  const writing = ref('')
  let controller: AbortController | undefined

  async function summarise() {
    const current = toValue(person)
    const target = key.value
    if (!on.value || busy.value || !target) return
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    busy.value = true
    error.value = ''
    writing.value = ''
    announce(`Summarising your mail with ${current.name}`)
    try {
      if (!folders.value.length) await until(() => folders.value.length > 0).toBe(true, { timeout: 5000 })
      const messages = await mailWith(current.emails, folders.value, MAX_MESSAGES)
      if (mine.signal.aborted) return
      if (!messages.length) {
        error.value = `There’s no recent mail with ${current.name} to go on.`
        announce(error.value)
        return
      }
      const bodies = await aiMailBodies(messages, FULL_BODIES)
      let raw = ''
      for await (const part of ai.stream({
        feature: 'relationship',
        system: RELATIONSHIP_SYSTEM,
        prompt: relationshipPrompt({ name: current.name, addresses: current.emails, messages, bodies }),
        maxTokens: 350,
        effort: 'medium',
        signal: mine.signal
      })) {
        raw += part
        writing.value = relationshipText(raw)
      }
      const text = relationshipText(raw)
      if (!text) throw new Error('The AI gave no answer.')
      const kept = Object.entries({ ...stored.value, [target]: { at: Date.now(), text, count: messages.length } })
        .sort(([, a], [, b]) => b.at - a.at)
        .slice(0, KEEP)
      stored.value = Object.fromEntries(kept)
      // Read out whole once it is done; while it was being written it was only shown
      announce(text)
    } catch (failure) {
      if (mine.signal.aborted || (failure as AiError).code === 'aborted') return
      error.value = (failure as AiError).code === 'limit'
        ? 'Today’s AI limit is reached. Raise it in Settings → AI.'
        : (failure as Error).message || 'The summary couldn’t be written.'
      announce('The summary couldn’t be written', true)
    } finally {
      if (controller === mine) {
        busy.value = false
        writing.value = ''
        controller = undefined
      }
    }
  }

  function cancel() {
    controller?.abort()
    busy.value = false
    writing.value = ''
  }

  // Another person: whatever was being written for the last one stops
  watch(key, cancel)
  if (getCurrentScope()) onScopeDispose(cancel)

  return { on, summary, busy, error, writing, summarise, cancel }
}
