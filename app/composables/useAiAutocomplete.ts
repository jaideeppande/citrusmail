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
        // Read whole rather than through text(), which trims: a continuation's
        // leading space is what separates it from the word before it
        let text = ''
        for await (const part of client.stream({
          feature: 'autocomplete',
          system: autocompleteSystem(),
          prompt: autocompletePrompt({ subject: draft.value.subject, ...context }),
          maxTokens: 40,
          effort: 'low',
          background: true,
          signal
        })) text += part
        return text.replace(/\s+$/, '')
      } catch (error) {
        if (error instanceof AiError && error.code === 'limit') pausedUntil = Date.now() + LIMIT_PAUSE
        throw error
      }
    },
    onShow: text => announce(`Suggestion: ${text.trim()}, press Tab to accept`)
  })
}
