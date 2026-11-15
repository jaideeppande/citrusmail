import type { z } from 'zod'
import type { AiFeatureId } from '~/utils/ai-features'

/** What a feature asks the model for */
export interface AiAsk {
  feature: AiFeatureId
  system: string
  prompt?: string
  messages?: { role: 'user' | 'assistant', content: string }[]
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  /** Asked without the person asking: counts against the daily limit */
  background?: boolean
  signal?: AbortSignal
}

export class AiError extends Error {
  constructor(message: string, readonly code?: 'limit' | 'aborted' | 'off' | 'unavailable' | 'invalid') {
    super(message)
  }
}

let listening: (() => void) | undefined
const waiting = new Map<string, (event: DesktopAiEvent) => void>()

/**
 * AI run by the desktop app on this computer. Every feature goes through
 * here: it checks the feature is switched on, streams the answer, and turns
 * the provider's failures into plain errors. Outside the desktop app there
 * is nothing to run it, and `available` stays false
 */
const _useAiClient = () => {
  const bridge = desktop()?.ai
  const status = ref<DesktopAiStatus>()
  /** Feature → on or off. Everything starts on (Settings → AI) */
  const switches = useLocalPref<Partial<Record<AiFeatureId, boolean>>>('ai-features', {})

  async function refresh() {
    status.value = await bridge?.status().catch(() => undefined)
  }
  refresh()
  // Keys are per computer, not per window: a key saved in one window counts in all
  onWindowEvent(event => event.type === 'settings:changed' && refresh())

  const available = computed(() => !!status.value?.active)
  const enabled = (feature: AiFeatureId) => available.value && switches.value[feature] !== false

  function setEnabled(feature: AiFeatureId, on: boolean) {
    switches.value = { ...switches.value, [feature]: on }
  }

  /** Streams the answer, piece by piece */
  async function* stream(ask: AiAsk): AsyncGenerator<string> {
    if (!bridge) throw new AiError('AI runs in the desktop app.', 'unavailable')
    if (!enabled(ask.feature)) throw new AiError('This AI feature is switched off in Settings → AI.', 'off')
    if (!listening) {
      listening = bridge.onEvent(event => waiting.get(event.id)?.(event))
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const queue: DesktopAiEvent[] = []
    let wake: (() => void) | undefined
    waiting.set(id, (event) => {
      queue.push(event)
      wake?.()
    })
    let finished = false
    const abort = () => bridge.cancel(id)
    ask.signal?.addEventListener('abort', abort, { once: true })
    bridge.start(id, { feature: ask.feature, background: ask.background, system: ask.system, prompt: ask.prompt, messages: ask.messages, maxTokens: ask.maxTokens, effort: ask.effort })
    try {
      while (true) {
        if (!queue.length) await new Promise<void>(resolve => (wake = resolve))
        const event = queue.shift()!
        if (event.type === 'text') {
          yield event.text
          continue
        }
        finished = true
        if (event.type === 'error') throw new AiError(event.message, event.code)
        return
      }
    } finally {
      waiting.delete(id)
      ask.signal?.removeEventListener('abort', abort)
      // Left early (the caller stopped reading): the request stops too
      if (!finished) bridge.cancel(id)
    }
  }

  /** The whole answer as text */
  async function text(ask: AiAsk): Promise<string> {
    let all = ''
    for await (const part of stream(ask)) all += part
    return all.trim()
  }

  /**
   * An answer that must be JSON of a given shape. The model is told to write
   * only JSON; what comes back is cut to the outermost object or array and
   * checked. One retry with the error, then it gives up rather than guess
   */
  async function json<T>(ask: AiAsk, schema: z.ZodType<T>): Promise<T> {
    const rule = '\nAnswer with JSON only: no prose before or after it, no Markdown code fences.'
    let attempt: AiAsk = { ...ask, system: ask.system + rule }
    for (let tries = 0; tries < 2; tries++) {
      const raw = await text(attempt)
      const parsed = parseJsonLoose(raw)
      const result = parsed === undefined ? undefined : schema.safeParse(parsed)
      if (result?.success) return result.data
      attempt = {
        ...attempt,
        messages: [
          ...(attempt.messages ?? [{ role: 'user' as const, content: attempt.prompt ?? '' }]),
          { role: 'assistant' as const, content: raw.slice(0, 4000) },
          { role: 'user' as const, content: `That wasn't valid: ${result ? result.error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'value'}: ${issue.message}`).join('; ') : 'not JSON'}. Answer again with JSON only.` }
        ],
        prompt: undefined
      }
    }
    throw new AiError('The AI’s answer didn’t make sense. Try again, or try another provider.', 'invalid')
  }

  return { bridge, status, refresh, available, enabled, switches, setEnabled, stream, text, json }
}

export const useAiClient = createAppComposable(_useAiClient)

/** The outermost JSON object or array in a reply that may have words around it */
export function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter(index => index >= 0)
  if (!starts.length) return undefined
  const start = Math.min(...starts)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (end <= start) return undefined
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return undefined
  }
}
