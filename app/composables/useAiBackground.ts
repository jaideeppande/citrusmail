import type { AiFeatureId } from '~/utils/ai-features'

/** New messages handed to a feature in one go: one request for the lot, not one each */
const BATCH = 12
const CHECK_EVERY = 60_000
/** Keys remembered per feature, so a message is never sent twice */
const REMEMBER = 3000

type Worker = (messages: MessageSummary[]) => Promise<void>

/**
 * AI that works without being asked: each background feature registers a
 * worker, and gets the Inbox's new messages once each, in batches. One
 * window does this at a time (whichever holds the lock), so two windows
 * never pay twice. When the day's limit is reached everything waits for
 * tomorrow and says so once, in the notification centre
 */
const _useAiBackground = () => {
  const ai = useAiClient()
  const { account } = useShell()
  const { folders } = useMail()
  const seen = useAccountPref<Partial<Record<AiFeatureId, string[]>>>('ai-seen', () => ({}))
  const workers = new Map<AiFeatureId, Worker>()
  const busy = ref(false)
  /** Set when the day's limit stops background work: the day it happened */
  const paused = useLocalPref<string>('ai-paused', '')
  const today = () => new Date().toISOString().slice(0, 10)

  /** Registers a background feature; it runs while switched on, from the next check */
  function register(feature: AiFeatureId, worker: Worker) {
    workers.set(feature, worker)
    if (getCurrentScope()) onScopeDispose(() => workers.delete(feature))
  }

  function mark(feature: AiFeatureId, messages: MessageSummary[]) {
    const keys = messages.map(labelKey)
    seen.value = { ...seen.value, [feature]: [...(seen.value[feature] ?? []), ...keys].slice(-REMEMBER) }
  }

  async function run() {
    if (busy.value || !ai.available.value || !account.value || paused.value === today()) return
    busy.value = true
    try {
      const inbox = folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
      const page = await $fetch<MessagePage>('/api/messages', { query: { folder: inbox } }).catch(() => undefined)
      if (!page) return
      for (const [feature, worker] of workers) {
        if (!ai.enabled(feature)) continue
        const done = new Set(seen.value[feature] ?? [])
        const fresh = page.messages.filter(message => !done.has(labelKey(message)))
        for (let at = 0; at < fresh.length; at += BATCH) {
          const batch = fresh.slice(at, at + BATCH)
          try {
            await worker(batch)
            mark(feature, batch)
          } catch (error) {
            if ((error as AiError).code === 'limit') {
              paused.value = today()
              useNotificationCentre().push({ kind: 'info', title: 'AI paused until tomorrow', body: 'Today’s limit for background AI is reached. Raise it in Settings → AI.', to: '/settings/ai', key: `ai-limit:${today()}` })
              return
            }
            // Switched off, or a provider error: try again at the next check, from the same place
            break
          }
        }
      }
    } finally {
      busy.value = false
    }
  }

  // Only the window holding the lock works; the others wait their turn
  let timer: ReturnType<typeof setInterval> | undefined
  const waiting = new AbortController()
  onNuxtReady(() => {
    if (windowKind() === 'pane') return
    const begin = () => {
      run()
      timer = setInterval(run, CHECK_EVERY)
    }
    if (navigator.locks) {
      navigator.locks.request('citrusmail-ai-background', { signal: waiting.signal }, () => new Promise<void>(() => begin())).catch(() => {})
    } else {
      begin()
    }
  })
  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearInterval(timer)
      waiting.abort()
    })
  }
  // New mail is the moment to look, not the next minute
  onWindowEvent(event => event.type === 'mail:refresh' && setTimeout(run, 2000))
  watch(() => ai.available.value, on => on && run())

  return { register, run, busy, paused: computed(() => paused.value === today()) }
}

export const useAiBackground = createAppComposable(_useAiBackground)
