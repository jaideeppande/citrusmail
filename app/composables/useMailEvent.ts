import { addMinutes } from 'date-fns'

// "Add to calendar" from a message: a small form filled in from what the
// message says, saved the way the calendar saves its own events
export function useMailEvent() {
  const overlay = useOverlay()
  const { account } = useShell()

  /** Only with a calendar connected (CalDAV) */
  const available = computed(() => !!account.value?.hasCalendar)

  async function open(seed: MailEventSeed) {
    if (!available.value) return
    const MailEventForm = (await import('~/components/mail/event-form/index.vue')).default
    overlay.create(MailEventForm, { props: { seed }, destroyOnClose: true }).open()
  }

  /** From a message: its subject as the title, who sent it and how it starts as the notes, the first date it names as the time */
  async function fromMessage(message: MessageDetail, date?: Pick<DateAction, 'start' | 'end' | 'allDay'>) {
    const text = writtenPart(messageText(message)).replace(/\s*\n\s*/g, '\n').trim()
    const excerpt = text.length > 400 ? `${text.slice(0, 400).trimEnd()}…` : text
    const title = (message.subject.replace(/^(?:\s*(?:re|fwd?)\s*:)+\s*/i, '').trim() || 'New event').slice(0, 100)
    let when = date ?? detectDates(`${message.subject}\n${text}`)[0]
    if (!when) {
      // The subject may still name a time in words the chips don't read ("lunch next Tuesday noon")
      const quick = await parseQuickEvent(message.subject)
      if (quick && quick.start > new Date()) when = quick
    }
    const start = when?.start ?? nextRoundHour()
    await open({
      title,
      description: `From ${formatAddress(message.from)}${excerpt ? `\n\n${excerpt}` : ''}`,
      start,
      end: when?.end ?? addMinutes(start, 60),
      allDay: when?.allDay ?? false
    })
  }

  return { available, open, fromMessage }
}
