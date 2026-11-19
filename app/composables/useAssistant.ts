/** Messages a "Your mail" answer lists under it */
const FOUND_SHOWN = 5

const MAIL: AssistantContext = { kind: 'mail' }
const chatKey = (context: AssistantContext) => context.kind === 'thread' ? `thread:${context.key}` : 'mail'
const turnId = () => Math.random().toString(36).slice(2, 10)

// The assistant: a chat about the open conversation or about your mail,
// slid over the right of the window. One for the whole app, opened by its
// shortcut, the palette, the window bar or "Ask about this" in the reader.
// Chats are kept in memory, one per conversation, and never saved
const _useAssistant = () => {
  const ai = useAiClient()
  const commands = useAiCommands()
  const { kbds } = useShortcutKeys()

  const isOpen = ref(false)
  const mode = ref<'ask' | 'do'>('ask')
  const chats = ref(new Map<string, AssistantChat>())
  const context = shallowRef<AssistantContext>(MAIL)
  const busy = ref(false)
  let controller: AbortController | undefined

  const chat = computed(() => chats.value.get(chatKey(context.value)))
  const turns = computed(() => chat.value?.turns ?? [])

  /** Whether the panel has anything it can do on this computer */
  const available = computed(() => ai.enabled('ask-thread') || ai.enabled('ask-mail') || ai.enabled('commands'))
  /** Whether a question can be asked in the current context */
  const canAsk = computed(() => context.value.kind === 'thread' ? ai.enabled('ask-thread') : ai.enabled('ask-mail'))

  function chatFor(target: AssistantContext): AssistantChat {
    const key = chatKey(target)
    let found = chats.value.get(key)
    if (!found) {
      chats.value.set(key, { key, context: target, turns: [] })
      // The reactive copy, so changes to it redraw the chat
      found = chats.value.get(key)!
    }
    return found
  }

  function open(target?: AssistantContext) {
    if (target) {
      context.value = target
      // A conversation is something to ask about, not something to act on
      if (target.kind === 'thread') mode.value = 'ask'
    }
    // Both slide in from the right: one at a time
    useTodayPanel().close()
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    if (isOpen.value) close()
    else open()
  }

  /** Takes the conversation chip off: questions are about your mail again */
  function clearContext() {
    context.value = MAIL
    announce('Asking about your mail')
  }

  function newChat() {
    controller?.abort()
    busy.value = false
    chats.value.delete(chatKey(context.value))
    announce('New chat')
  }

  /** The conversation as the model reads it, read once per chat without marking anything read */
  async function threadPrompt(target: Extract<AssistantContext, { kind: 'thread' }>, current: AssistantChat) {
    if (current.prompt) return current.prompt
    const cache = useMessageCache()
    const details = await Promise.all(target.messages.map(message => cache.peek(message.folder, message.id).then(entry => entry.message).catch(() => undefined)))
    const parts = details.filter(detail => detail !== undefined).map(detail => messageForPrompt(detail))
    if (!parts.length) throw new AiError('Couldn’t read the conversation. Try again.')
    current.prompt = threadForPrompt(parts)
    return current.prompt
  }

  async function answerThread(current: AssistantChat, question: string, answer: AssistantTurn, signal: AbortSignal) {
    const target = current.context as Extract<AssistantContext, { kind: 'thread' }>
    const prompt = await threadPrompt(target, current)
    // Earlier questions that got an answer, in turn, then this one
    const history: { role: 'user' | 'assistant', content: string }[] = []
    const asked = current.turns.filter(turn => turn.mode === 'ask')
    for (const [index, turn] of asked.slice(0, -2).entries()) {
      const next = asked[index + 1]
      if (turn.role === 'user' && next?.role === 'assistant' && next.state === 'done') history.push({ role: 'user', content: turn.text }, { role: 'assistant', content: next.text })
    }
    history.push({ role: 'user', content: question })
    for await (const part of ai.stream({ feature: 'ask-thread', system: askThreadSystem, messages: askThreadMessages(prompt, history), maxTokens: 1200, signal })) {
      answer.text += part
    }
  }

  async function answerMail(question: string, answer: AssistantTurn) {
    const result = await askMailHere(question)
    answer.text = result.answer || (result.messages.length ? 'These look like the closest matches.' : 'Nothing in your mail matches that.')
    answer.found = result.messages.slice(0, FOUND_SHOWN)
    answer.interpreted = result.interpreted
  }

  async function doCommand(request: string, answer: AssistantTurn) {
    const outcome = await commands.start(request)
    if (outcome.errors.length) {
      answer.state = 'error'
      answer.text = outcome.errors.join('\n')
      return
    }
    if (!outcome.description) answer.text = 'Cancelled.'
    else answer.text = commands.found.value.length ? `${outcome.description}. Check the list, then confirm or cancel.` : outcome.description
  }

  /** Sends what was typed: a question, or in "Do something" a command */
  async function send(text: string) {
    const question = text.trim()
    if (!question || busy.value) return
    const current = chatFor(context.value)
    const doing = mode.value === 'do' && commands.available.value
    current.turns.push({ id: turnId(), role: 'user', mode: doing ? 'do' : 'ask', text: question, state: 'done' })
    current.turns.push({ id: turnId(), role: 'assistant', mode: doing ? 'do' : 'ask', text: '', state: 'writing' })
    // Changed through the reactive copy, so the chat redraws as the answer streams in
    const answer = current.turns.at(-1)!
    busy.value = true
    controller?.abort()
    const signal = (controller = new AbortController()).signal
    try {
      if (doing) await doCommand(question, answer)
      else if (current.context.kind === 'thread') await answerThread(current, question, answer, signal)
      else await answerMail(question, answer)
      if (answer.state === 'writing') answer.state = answer.text.trim() ? 'done' : 'error'
      if (answer.state === 'error' && !answer.text.trim()) answer.text = 'No answer came back. Try again.'
      if (!doing) announce(answer.state === 'done' ? 'Answer ready' : 'No answer')
    } catch (error) {
      if (signal.aborted) return
      answer.state = 'error'
      answer.text = error instanceof AiError ? error.message : 'Something went wrong. Try again.'
      announce(answer.text, true)
    } finally {
      if (controller?.signal === signal) busy.value = false
    }
  }

  function stop() {
    controller?.abort()
    busy.value = false
    const last = turns.value.at(-1)
    if (last?.mode === 'do') commands.cancel()
    if (last?.state === 'writing') last.state = last.text.trim() ? 'done' : 'error'
    if (last && !last.text.trim()) last.text = 'Stopped.'
  }

  defineAppShortcuts({
    'app.assistant': { usingInput: true, handler: () => available.value && toggle() }
  })

  useCommands(() => available.value
    ? [{
        id: 'assistant',
        label: 'AI',
        items: [{
          label: 'Ask AI',
          suffix: 'About your mail, or to do something with it',
          icon: 'i-lucide-sparkles',
          kbds: kbds('app.assistant').map(value => ({ value, variant: 'soft' as const })),
          onSelect: () => open()
        }]
      }]
    : [])

  return { isOpen, available, canAsk, mode, context, chat, turns, busy, open, close, toggle, clearContext, newChat, send, stop }
}

export const useAssistant = createAppComposable(_useAssistant)
