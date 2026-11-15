const DAY = 86_400_000

// Sent mail that never got an answer. A sent message is waiting when it's
// older than the days set in Settings → Reading, newer than a month, and
// nothing in the Inbox with the same subject has come from one of the people
// it went to since. Worked out from the two lists the app already loads
const _useNudges = () => {
  const prefs = usePrefs()
  const { folder, messages, folders } = useMail()
  const { account } = useShell()
  const inbox = ref<MessageSummary[]>([])

  const watching = computed(() => prefs.value.nudgeDays > 0 && folder.value?.role === 'sent')

  async function load() {
    const path = folders.value.find(item => item.role === 'inbox')?.path ?? 'INBOX'
    const page = await $fetch<MessagePage>('/api/messages', { query: { folder: path } }).catch(() => undefined)
    if (page) inbox.value = page.messages
  }
  watch(watching, on => on && load(), { immediate: true })

  const waiting = computed(() => {
    const result = new Map<string, number>()
    if (!watching.value) return result
    const now = Date.now()
    const self = account.value?.email.toLowerCase()
    for (const message of messages.value) {
      const sent = new Date(message.date).getTime()
      const age = now - sent
      if (age < prefs.value.nudgeDays * DAY || age > 30 * DAY) continue
      const people = new Set(message.to.map(address => address.address.toLowerCase()).filter(address => address !== self))
      const subject = threadSubject(message.subject)
      // A note to yourself, or one with no subject to match on, waits for no one
      if (!people.size || !subject) continue
      const answered = inbox.value.some(reply => people.has(reply.from.address.toLowerCase()) && threadSubject(reply.subject) === subject && new Date(reply.date).getTime() > sent)
      // A later message of your own in the same conversation is already a follow-up
      const followed = messages.value.some(other => other !== message && threadSubject(other.subject) === subject && new Date(other.date).getTime() > sent)
      if (!answered && !followed) result.set(messageKey(message), Math.floor(age / DAY))
    }
    return result
  })

  // Each one is said once in the notification centre, the first time it's noticed
  const told = useAccountPref<string[]>('nudged', () => [])
  watch(waiting, (map) => {
    const fresh = [...map.keys()].filter(key => !told.value.includes(key))
    if (!fresh.length) return
    const centre = useNotificationCentre()
    for (const key of fresh) {
      const message = messages.value.find(item => messageKey(item) === key)
      if (!message) continue
      centre.push({ kind: 'nudge', title: `No reply from ${personName(message.to[0])}`, body: `${message.subject || '(No subject)'} · sent ${map.get(key)} days ago`, to: `${folderLink(message.folder)}?m=${encodeURIComponent(message.id)}`, key: `nudge:${key}` })
    }
    told.value = [...told.value, ...fresh].slice(-200)
  })

  /** Days a sent message has gone unanswered, when that's long enough to say so */
  const waitingDays = (message: MessageSummary) => waiting.value.get(messageKey(message))

  /** Opens a reply to your own message, addressed to the people it went to */
  async function followUp(message: MessageSummary) {
    const cache = useMessageCache()
    const { start } = useComposer()
    const detail = await cache.open(message.folder, message.id).then(entry => entry.message).catch(() => undefined)
    const first = personName(message.to[0]).split(/[\s@]/)[0]
    const text = detail?.text?.trim() || message.preview
    start({
      to: message.to,
      cc: detail?.cc ?? [],
      subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
      html: `<p>Hi ${escapeHtml(first ?? '')},</p><p>Just following up on my message below. Is there anything you need from me?</p>`,
      quote: `<br><p>On ${escapeHtml(fullDate(message.date))}, I wrote:</p><blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">${detail?.html?.trim() || escapeHtml(text).replace(/\n/g, '<br>')}</blockquote>`,
      quoteText: `On ${fullDate(message.date)}, I wrote:\n\n${text}`,
      inReplyTo: detail?.messageId ?? message.messageId,
      references: [...(detail?.references ?? []), ...(message.messageId ? [message.messageId] : [])]
    })
  }

  return { waitingDays, followUp }
}

export const useNudges = createAppComposable(_useNudges)
