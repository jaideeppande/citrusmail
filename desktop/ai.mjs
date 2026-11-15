// AI on this computer. The desktop app's main process talks to the AI
// provider itself, with keys kept in the operating system's keychain
// (safeStorage), so neither the page nor the server ever holds them. The
// page asks for a piece of writing; the answer streams back over IPC.
// What each feature used today is counted, and background features stop
// for the day once the daily limit is reached
import Anthropic from '@anthropic-ai/sdk'
import { safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-opus-5-5', hint: 'console.anthropic.com → API keys' },
  openai: { label: 'OpenAI', model: 'gpt-5', base: 'https://api.openai.com/v1', hint: 'platform.openai.com → API keys' },
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', hint: 'aistudio.google.com → Get API key' },
  grok: { label: 'xAI Grok', model: 'grok-4', base: 'https://api.x.ai/v1', hint: 'console.x.ai → API keys' },
  perplexity: { label: 'Perplexity', model: 'sonar-pro', base: 'https://api.perplexity.ai', hint: 'perplexity.ai → Settings → API' }
}
const ORDER = Object.keys(PROVIDERS)
const DEFAULT_LIMIT = 300

let file
let state
function load(userData) {
  file = join(userData, 'ai.json')
  try {
    state = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    state = {}
  }
  state.keys ??= {}
  state.usage ??= {}
  state.limit ??= DEFAULT_LIMIT
}
function save() {
  writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 })
}

// A key is stored encrypted with the keychain's key, never in plain text.
// Where the system offers no keychain (some Linux desktops), Electron falls
// back to a weak built-in key, and the status says so
const seal = key => safeStorage.encryptString(key).toString('base64')
const open = sealed => safeStorage.decryptString(Buffer.from(sealed, 'base64'))

export function status() {
  const providers = ORDER.map(provider => ({
    provider,
    label: PROVIDERS[provider].label,
    saved: !!state.keys[provider],
    hint: PROVIDERS[provider].hint,
    model: state.keys[provider]?.model || PROVIDERS[provider].model
  }))
  const active = state.active && state.keys[state.active] ? state.active : providers.find(item => item.saved)?.provider
  return {
    providers,
    active,
    secure: safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
  }
}

export function setKey({ provider, key, model, use }) {
  if (!PROVIDERS[provider]) throw new Error('Unknown provider')
  if (key === '') {
    delete state.keys[provider]
    if (state.active === provider) delete state.active
  } else {
    if (key !== undefined && !/^[\w.-]{8,400}$/.test(key)) throw new Error('That doesn’t look like an API key')
    if (model !== undefined && !/^[\w.:/-]{0,100}$/.test(model)) throw new Error('That isn’t a model name')
    const current = state.keys[provider]
    if (!key && !current) throw new Error('Enter a key first')
    state.keys[provider] = { sealed: key ? seal(key) : current.sealed, model: model !== undefined ? model || undefined : current?.model }
    if (use || !state.active) state.active = provider
  }
  save()
  return status()
}

/* Usage --------------------------------------------------------------- */

const today = () => new Date().toISOString().slice(0, 10)

function record(feature, background, usage) {
  const day = today()
  const days = state.usage
  days[day] ??= {}
  const entry = days[day][feature] ??= { requests: 0, background: 0, input: 0, output: 0 }
  entry.requests++
  if (background) entry.background++
  entry.input += usage.input
  entry.output += usage.output
  // Ninety days is plenty for a usage page
  for (const old of Object.keys(days).sort().slice(0, -90)) delete days[old]
  save()
}

const backgroundToday = () => Object.values(state.usage[today()] ?? {}).reduce((sum, entry) => sum + entry.background, 0)

export function usage() {
  return { days: state.usage, limit: state.limit, backgroundToday: backgroundToday() }
}

export function setLimit(limit) {
  state.limit = Math.max(0, Math.min(100_000, Math.round(Number(limit) || 0)))
  save()
  return usage()
}

/* Providers ----------------------------------------------------------- */

function providerError(provider, status, detail = '') {
  const label = PROVIDERS[provider].label
  if (status === 401 || status === 403) return new Error(`${label} didn’t accept your API key. Check it in Settings → AI.`)
  if (status === 429) return new Error(`${label} says you’ve hit your rate limit or run out of credit.`)
  return new Error(`${label} couldn’t answer${detail ? `: ${String(detail).slice(0, 200)}` : '.'}`)
}

async function* sse(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data)
      } catch {
        // A keep-alive or a partial line
      }
    }
  }
}

/** The conversation as each provider wants it: a system prompt, then turns */
const turns = request => request.messages?.length ? request.messages : [{ role: 'user', content: request.prompt }]

async function* streamAnthropic(key, model, request, signal, usage) {
  const client = new Anthropic({ apiKey: key })
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      messages: turns(request),
      output_config: { effort: request.effort ?? 'medium' },
      // If the safety classifiers decline, the API reruns on the recommended model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    }, { signal })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
    }
    const final = await stream.finalMessage()
    usage.input = final.usage?.input_tokens ?? 0
    usage.output = final.usage?.output_tokens ?? 0
    if (final.stop_reason === 'refusal') throw new Error('Claude declined to write this one.')
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw providerError('anthropic', 401)
    if (error instanceof Anthropic.RateLimitError) throw providerError('anthropic', 429)
    if (error instanceof Anthropic.APIUserAbortError) throw error
    if (error instanceof Anthropic.APIError) throw providerError('anthropic', error.status ?? 502, error.message)
    throw error
  }
}

async function* streamOpenAiCompatible(provider, key, model, request, signal, usage) {
  const response = await fetch(`${PROVIDERS[provider].base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      // OpenAI reports what was used in a last, empty chunk; the others ignore it or send it anyway
      ...(provider === 'openai' ? { stream_options: { include_usage: true } } : {}),
      messages: [{ role: 'system', content: request.system }, ...turns(request)]
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)])
  })
  if (!response.ok) throw providerError(provider, response.status, await response.text().catch(() => ''))
  for await (const chunk of sse(response)) {
    if (chunk.usage) {
      usage.input = chunk.usage.prompt_tokens ?? usage.input
      usage.output = chunk.usage.completion_tokens ?? usage.output
    }
    const text = chunk.choices?.[0]?.delta?.content
    if (text) yield text
  }
}

async function* streamGemini(key, model, request, signal, usage) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: turns(request).map(turn => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.content }] }))
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)])
  })
  if (!response.ok) throw providerError('gemini', response.status, await response.text().catch(() => ''))
  for await (const chunk of sse(response)) {
    if (chunk.usageMetadata) {
      usage.input = chunk.usageMetadata.promptTokenCount ?? usage.input
      usage.output = chunk.usageMetadata.candidatesTokenCount ?? usage.output
    }
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) if (part.text) yield part.text
  }
}

/* Requests ------------------------------------------------------------ */

const running = new Map()
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''

/** A request from the page, held to sane sizes: the page is trusted, its inputs are still checked */
function clean(request) {
  const messages = Array.isArray(request?.messages)
    ? request.messages.slice(-40).filter(turn => turn && (turn.role === 'user' || turn.role === 'assistant')).map(turn => ({ role: turn.role, content: text(turn.content, 200_000) }))
    : undefined
  return {
    feature: /^[\w.-]{1,40}$/.test(request?.feature ?? '') ? request.feature : 'other',
    background: !!request?.background,
    system: text(request?.system, 40_000),
    prompt: text(request?.prompt, 400_000),
    messages: messages?.length ? messages : undefined,
    maxTokens: Math.max(16, Math.min(64_000, Number(request?.maxTokens) || 16_000)),
    effort: ['low', 'medium', 'high'].includes(request?.effort) ? request.effort : 'medium'
  }
}

/**
 * Starts a request and streams it to `send(event)`: { type: 'text', text }
 * for each piece, then { type: 'done', usage } or { type: 'error', message }
 */
export async function start(id, raw, send) {
  const request = clean(raw)
  const { active } = status()
  const saved = active && state.keys[active]
  if (!saved) return send({ type: 'error', message: 'Add an AI key in Settings → AI first.' })
  if (request.background && backgroundToday() >= state.limit) {
    return send({ type: 'error', code: 'limit', message: 'Today’s limit for AI working in the background is reached. It starts again tomorrow, or raise it in Settings → AI.' })
  }
  let key
  try {
    key = open(saved.sealed)
  } catch {
    return send({ type: 'error', message: 'Your saved key couldn’t be read from the keychain. Enter it again in Settings → AI.' })
  }
  const model = saved.model || PROVIDERS[active].model
  const controller = new AbortController()
  running.set(id, controller)
  const usage = { input: 0, output: 0 }
  let written = 0
  try {
    const parts = active === 'anthropic'
      ? streamAnthropic(key, model, request, controller.signal, usage)
      : active === 'gemini'
        ? streamGemini(key, model, request, controller.signal, usage)
        : streamOpenAiCompatible(active, key, model, request, controller.signal, usage)
    for await (const part of parts) {
      written += part.length
      send({ type: 'text', text: part })
    }
    // Some providers don't say what was used: a rough count, four characters a token
    if (!usage.input) usage.input = Math.ceil((request.system.length + request.prompt.length + (request.messages ?? []).reduce((sum, turn) => sum + turn.content.length, 0)) / 4)
    if (!usage.output) usage.output = Math.ceil(written / 4)
    record(request.feature, request.background, usage)
    send({ type: 'done', usage, provider: active, model })
  } catch (error) {
    if (controller.signal.aborted) send({ type: 'error', code: 'aborted', message: 'Stopped' })
    else send({ type: 'error', message: error?.message || 'The AI couldn’t answer. Try again in a moment.' })
  } finally {
    running.delete(id)
  }
}

export function cancel(id) {
  running.get(id)?.abort()
}

export function init(userData) {
  load(userData)
}
