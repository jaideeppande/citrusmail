import { addDays, startOfDay } from 'date-fns'
import type { BriefingBullet, BriefingInput } from '~/utils/ai-calendar'

interface StoredBriefing {
  /** The day it is for, YYYY-MM-DD */
  day: string
  at: number
  bullets: BriefingBullet[]
}

/** Before this hour the day hasn't started, and a briefing written now would miss the night's mail */
const MORNING = 5
/** New mail counts from yesterday evening */
const SINCE_HOUR = 17
const MAX_MAIL = 40

/**
 * The daily briefing at the top of the Today panel: what came in that needs
 * you, who you're waiting on, and what today holds, in a few lines. Written
 * once a day, the first time the panel opens after five in the morning, and
 * again whenever Refresh is pressed. Kept for the day on this computer
 */
const _useAiBriefing = () => {
  const ai = useAiClient()
  const { account } = useShell()
  const { folders } = useMail()
  const { eventsForDay, ensureRange, isRangePending } = useCalendarEvents()
  const prefs = usePrefs()
  const priority = useAiPriority()

  const stored = useAccountPref<StoredBriefing | null>('ai-briefing', () => null)
  const on = computed(() => ai.enabled('briefing'))
  const busy = ref(false)
  const error = ref('')
  /** The day an attempt failed: the panel doesn't try again on its own that day */
  let failedOn = ''
  let controller: AbortController | undefined

  const today = () => isoDate(new Date())
  const current = computed(() => stored.value?.day === today() ? stored.value : null)

  async function page(query: Record<string, string>): Promise<MessageSummary[]> {
    return (await $fetch<MessagePage>('/api/messages', { query }).catch(() => undefined))?.messages ?? []
  }

  async function gather(now: Date): Promise<BriefingInput> {
    if (!folders.value.length) await until(() => folders.value.length > 0).toBe(true, { timeout: 5000 })
    const inbox = folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'
    const sent = folders.value.find(folder => folder.role === 'sent')?.path
    const since = addDays(startOfDay(now), -1).getTime() + SINCE_HOUR * 3_600_000

    const day = startOfDay(now)
    const range = { start: day, end: addDays(day, 1) }
    if (account.value?.hasCalendar) ensureRange(range)

    const [unread, recent, written] = await Promise.all([
      page({ folder: inbox, unread: '1' }),
      page({ folder: inbox }),
      sent ? page({ folder: sent }) : Promise.resolve([])
    ])

    // Today's events, once the calendar has them
    if (account.value?.hasCalendar && isRangePending(range)) {
      await until(() => isRangePending(range)).toBe(false, { timeout: 8000 }).catch(() => {})
    }
    const events = account.value?.hasCalendar
      ? [...eventsForDay(day)].sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.start.localeCompare(b.start)).slice(0, 15)
      : []

    const self = [account.value?.email ?? '', ...(account.value?.mailboxes?.map(mailbox => mailbox.email) ?? [])].filter(Boolean)
    const fresh = (message: MessageSummary) => Date.parse(message.date) >= since

    // With the priority inbox on, its verdicts pick the mail: what it says
    // needs you, read or not, and anything unread it hasn't looked at yet
    let mail = unread.filter(fresh)
    let verdicts: BriefingInput['verdicts']
    if (priority.on.value) {
      const unreadKeys = new Set(unread.map(labelKey))
      const merged = [...new Map([...recent, ...unread].map(message => [labelKey(message), message])).values()]
        .filter(fresh)
        .filter((message) => {
          const verdict = priority.of(message)
          return verdict ? needsReader(verdict.kind) : unreadKeys.has(labelKey(message))
        })
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      mail = merged
      verdicts = merged.slice(0, MAX_MAIL).map(message => priority.of(message))
    }

    return {
      now,
      mail: mail.slice(0, MAX_MAIL),
      verdicts,
      waiting: waitingOnOthers(written, recent, { self, days: prefs.value.nudgeDays || 2, now: now.getTime() }),
      events
    }
  }

  /** Writes today's briefing. `background` when nobody asked: on the panel's first opening */
  async function generate(background = false) {
    if (!on.value || busy.value) return
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    busy.value = true
    error.value = ''
    if (!background) announce('Writing your briefing')
    try {
      const now = new Date()
      const input = await gather(now)
      let bullets: BriefingBullet[]
      // Nothing to say costs nothing to say
      if (!input.mail.length && !input.waiting.length && !input.events.length) {
        bullets = [{ text: 'Nothing new needs you since yesterday evening, nobody owes you a reply, and your calendar is clear today.' }]
      } else {
        const answer = await ai.json({
          feature: 'briefing',
          system: BRIEFING_SYSTEM,
          prompt: briefingPrompt(input),
          maxTokens: 600,
          effort: 'low',
          background,
          signal: mine.signal
        }, briefingSchema)
        bullets = briefingBullets(answer, input)
      }
      if (mine.signal.aborted) return
      stored.value = { day: isoDate(now), at: Date.now(), bullets }
      announce(`Briefing ready, ${bullets.length === 1 ? '1 point' : `${bullets.length} points`}`)
    } catch (failure) {
      if (mine.signal.aborted || (failure as AiError).code === 'aborted') return
      error.value = (failure as AiError).code === 'limit'
        ? 'Today’s AI limit is reached. Raise it in Settings → AI.'
        : (failure as Error).message || 'The briefing couldn’t be written.'
      failedOn = today()
      announce('The briefing couldn’t be written', true)
    } finally {
      if (controller === mine) {
        busy.value = false
        controller = undefined
      }
    }
  }

  /** The panel opened: the day's briefing, if it isn't written yet and the morning has begun */
  function ensureToday() {
    if (!on.value || current.value || busy.value || failedOn === today()) return
    if (new Date().getHours() < MORNING) return
    generate(true)
  }

  function cancel() {
    controller?.abort()
    busy.value = false
  }

  return { on, current, busy, error, generate, ensureToday, cancel }
}

export const useAiBriefing = createAppComposable(_useAiBriefing)
