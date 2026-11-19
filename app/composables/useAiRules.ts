// Rules in plain English: "move receipts from shops to Receipts and mark them
// read" becomes a rule, opened in the usual editor for the person to check
// and save. The model only fills the form; it never saves anything
export function useAiRules() {
  const ai = useAiClient()
  const { folders } = useMail()

  const available = computed(() => ai.enabled('rules'))
  const status = ref<'idle' | 'thinking' | 'error'>('idle')
  const error = ref('')
  let controller: AbortController | undefined

  /** The rule and what to tell the person about it, or nothing when it failed (see `error`) */
  async function draft(description: string): Promise<{ rule: RuleInput, notes: string[] } | undefined> {
    const text = description.trim()
    if (!text) return undefined
    controller?.abort()
    const signal = (controller = new AbortController()).signal
    status.value = 'thinking'
    error.value = ''
    try {
      const answer = await ai.json({ feature: 'rules', system: rulesSystem(folders.value), prompt: text, maxTokens: 600, effort: 'low', signal }, aiRuleSchema)
      if (signal.aborted) return undefined
      status.value = 'idle'
      return ruleFromAi(answer, folders.value, crypto.randomUUID())
    } catch (failure) {
      if (signal.aborted) return undefined
      status.value = 'error'
      error.value = failure instanceof AiError ? failure.message : 'Something went wrong. Try again.'
      announce(error.value, true)
      return undefined
    }
  }

  onScopeDispose(() => controller?.abort())

  return { available, status, error, draft }
}
