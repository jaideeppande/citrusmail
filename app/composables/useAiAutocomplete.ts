import { AiError } from '~/composables/useAiClient'

/** After the day's AI limit is reached, how long the ghost text stops asking */
const LIMIT_PAUSE = 10 * 60_000

/**
 * The composer's ghost text, set up for the draft on screen: the subject,
 * the paragraph being typed and the two before it go to the model, nothing
 * else of the draft and never the quoted original. Counted as a background
 * request (it runs without being asked), so it uses the daily limit
 */
export function useAiAutocomplete() {
  const client = useAiClient()
  const { draft } = useComposer()
  const { busy } = useAiWriting()
  const { writing } = useAiReply()
  let pausedUntil = 0

  return AiAutocomplete.configure({
    enabled: () => client.enabled('autocomplete') && !busy.value && !writing.value && Date.now() > pausedUntil,
    complete: async (context, signal) => {
      try {
        return await client.text({
          feature: 'autocomplete',
          system: autocompleteSystem(),
          prompt: autocompletePrompt({ subject: draft.value.subject, ...context }),
          maxTokens: 40,
          effort: 'low',
          background: true,
          signal
        })
      } catch (error) {
        if (error instanceof AiError && error.code === 'limit') pausedUntil = Date.now() + LIMIT_PAUSE
        throw error
      }
    },
    onShow: text => announce(`Suggestion: ${text.trim()}, press Tab to accept`)
  })
}
