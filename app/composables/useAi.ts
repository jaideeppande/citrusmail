import type { AiAsk } from '~/composables/useAiClient'

// The AI features, available once a key is saved in Settings → AI. Replies
// and summaries stream in as they're written. In the desktop app the app
// itself runs them with the key in the system keychain (useAiClient); a key
// saved on the server is the fallback, and the only way in a browser
const _useAi = () => {
  const client = useAiClient()
  const cache = useMessageCache()
  const { settings } = useSettings()
  const { account } = useShell()
  const { data: status, refresh } = useFetch<AiStatus>('/api/ai', {
    key: 'ai-status',
    server: false,
    default: () => ({ providers: [] })
  })

  /** The server has a key to fall back on */
  const serverReady = computed(() => Boolean(status.value.active))
  /** This computer runs AI itself */
  const local = computed(() => client.available.value)
  const ready = computed(() => local.value || serverReady.value)
  const providerLabel = computed(() => local.value
    ? client.status.value?.providers.find(item => item.provider === client.status.value?.active)?.label
    : status.value.providers.find(item => item.provider === status.value.active)?.label)

  // The server routes, as the app runs them here. Each fetches the message
  // it needs without marking it read, then builds the server's own prompt
  const message = (body: { folder: string, id: string }) => cache.peek(body.folder, body.id).then(entry => entry.message)
  const LOCAL: Record<string, (body: Record<string, unknown>) => Promise<AiAsk>> = {
    '/api/ai/summarize': async body => ({
      feature: 'summary',
      system: summarizeSystem(languageName(settings.value.language || 'en')),
      prompt: messageForPrompt(await message(body as { folder: string, id: string })),
      maxTokens: 2000,
      effort: 'low'
    }),
    '/api/ai/reply': async body => ({
      feature: body.tweak ? 'tone' : 'reply',
      system: replySystem({ email: account.value?.email ?? '', name: account.value?.name }),
      prompt: replyPrompt(await message(body as { folder: string, id: string }), body as { instruction?: string, draft?: string, tweak?: string }),
      maxTokens: 4000,
      effort: 'medium'
    }),
    '/api/ai/translate': async body => ({
      feature: 'translate',
      system: translateSystem(String(body.to)),
      prompt: translatePrompt(body.segments as string[]),
      maxTokens: 32_000,
      effort: 'low'
    })
  }

  /**
   * Streams a response from one of the /api/ai routes, calling `onText` with
   * everything written so far. Throws with the server's message on failure
   */
  async function stream(path: string, body: unknown, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
    const build = local.value ? LOCAL[path] : undefined
    if (build) {
      let text = ''
      for await (const part of client.stream({ ...await build(body as Record<string, unknown>), signal })) {
        text += part
        onText(text)
      }
      return text
    }
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone },
      body: JSON.stringify(body),
      signal
    })
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(data.message || 'The AI couldn’t answer. Try again in a moment.')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      onText(text)
    }
    return text
  }

  return { status, refresh, ready, local, serverReady, providerLabel, stream }
}

export const useAi = createAppComposable(_useAi)

/** Plain text from the model as the editor's paragraphs */
export function textToHtml(text: string) {
  return text.trim().split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
}
