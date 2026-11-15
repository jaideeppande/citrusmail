import { addMinutes } from 'date-fns'
import type { AiEventPlan, MailEventFill } from '~/utils/ai-calendar'

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The rule-based reading as a plan: what a phrase becomes with no AI, or when the AI fails */
export function rulesPlan(quick: QuickEvent | null, phrase: string): AiEventPlan {
  // No time in the phrase: the next full hour, as the `+` button would
  const start = quick?.start ?? nextRoundHour()
  return {
    title: (quick?.title || phrase).slice(0, 100) || DEFAULT_TITLE,
    start,
    end: quick?.end ?? addMinutes(start, 60),
    allDay: quick?.allDay ?? false,
    reminder: asksForReminder(phrase)
  }
}

/**
 * Events in plain English. The rule-based parser answers at once; with the
 * feature on, the phrase then goes to the AI, whose reading replaces it when
 * it holds together. Nothing is created here: the caller shows the plan and
 * waits for Create or Edit
 */
export function useAiQuickEvent() {
  const ai = useAiClient()
  const { calendars } = useCalendarEvents()
  const { defaultCalendarId } = useEventDraft()

  const on = computed(() => ai.enabled('quick-event'))
  const plan = shallowRef<AiEventPlan>()
  /** reading: the AI is on it; ai: its answer; rules: the quick reading stands */
  const state = ref<'idle' | 'reading' | 'ai' | 'rules'>('idle')
  /** Why the quick reading stands, when the AI was asked and didn't help */
  const note = ref('')
  let controller: AbortController | undefined

  const calendarName = computed(() => {
    const id = plan.value?.calendarId ?? defaultCalendarId()
    return calendars.value.find(calendar => calendar.id === id)?.name
  })

  const preview = computed(() => plan.value ? aiEventPreview(plan.value, calendarName.value) : '')

  async function read(phrase: string) {
    cancel()
    const mine = new AbortController()
    controller = mine
    note.value = ''
    plan.value = rulesPlan(await parseQuickEvent(phrase), phrase)
    if (mine.signal.aborted) return
    state.value = 'reading'
    const now = new Date()
    try {
      const answer = await ai.json({
        feature: 'quick-event',
        system: QUICK_EVENT_SYSTEM,
        prompt: quickEventPrompt(phrase, { now, timeZone: timeZone(), calendars: calendars.value.map(calendar => calendar.name) }),
        maxTokens: 300,
        effort: 'low',
        signal: mine.signal
      }, quickEventSchema)
      if (mine.signal.aborted) return
      const result = quickEventPlan(answer, { text: phrase, now, calendars: calendars.value })
      if (!result) {
        note.value = 'The AI’s date didn’t make sense, so this is the quick reading.'
        state.value = 'rules'
      } else {
        plan.value = result
        state.value = 'ai'
      }
    } catch (error) {
      if (mine.signal.aborted || (error as AiError).code === 'aborted') return
      note.value = (error as AiError).code === 'limit' ? 'Today’s AI limit is reached, so this is the quick reading.' : 'The AI couldn’t read it, so this is the quick reading.'
      state.value = 'rules'
    }
    announce(`${state.value === 'ai' ? 'Suggested' : 'Read as'}: ${preview.value}${plan.value?.reminder ? '. Reminders aren’t supported yet' : ''}`)
  }

  /** Stops the AI, keeping whatever plan is showing */
  function cancel() {
    controller?.abort()
    controller = undefined
    if (state.value === 'reading') state.value = 'rules'
  }

  function reset() {
    cancel()
    plan.value = undefined
    state.value = 'idle'
    note.value = ''
  }

  /** The event the plan makes, on its calendar or the first one showing */
  function toEvent(): CalendarEvent | undefined {
    const current = plan.value
    if (!current) return undefined
    return {
      id: crypto.randomUUID(),
      calendarId: current.calendarId ?? defaultCalendarId(),
      title: current.title,
      description: current.description,
      start: toLocalISO(current.start),
      end: toLocalISO(current.end),
      allDay: current.allDay || undefined
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel)

  return { on, plan, state, note, preview, calendarName, read, cancel, reset, toEvent }
}

/**
 * Event from an email, read by the AI: title, time, place and the people in
 * it. One message, one request; what comes back is checked and anything
 * that doesn't hold together is left out
 */
export function useAiMailEvent() {
  const ai = useAiClient()
  const { account } = useShell()

  const on = computed(() => ai.enabled('mail-event'))

  async function fill(source: { folder: string, id: string } | MessageDetail, options: { hint?: Date, signal?: AbortSignal } = {}): Promise<MailEventFill> {
    // The whole message, without marking it read
    const message = 'subject' in source ? source : (await useMessageCache().peek(source.folder, source.id)).message
    const now = new Date()
    const me = account.value?.email
    const answer = await ai.json({
      feature: 'mail-event',
      system: MAIL_EVENT_SYSTEM,
      prompt: mailEventPrompt(messageForPrompt(message, 12_000), { now, timeZone: timeZone(), me, hint: options.hint }),
      maxTokens: 500,
      effort: 'low',
      signal: options.signal
    }, mailEventSchema)
    return mailEventFill(answer, { now, me })
  }

  return { on, fill }
}
