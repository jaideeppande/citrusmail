/** How long an answer from Sent stays good: stepping back to a message doesn't ask again */
const SENT_FRESH = 2 * 60_000

const sentReplies = new Map<string, { at: number, messages: MessageSummary[] }>()

// The conversation the open message belongs to: the messages of it that are
// loaded in the list, and your own replies, which live in Sent and are
// fetched by subject. Oldest first; a single message when threading is off
export function useThread(summary: () => MessageSummary | undefined) {
  const { thread, folders } = useMail()
  const { account } = useShell()
  const prefs = usePrefs()

  const replies = shallowRef<MessageSummary[]>([])
  const sent = computed(() => folders.value.find(folder => folder.role === 'sent'))
  const own = (address?: Address) => !!address?.address && address.address.toLowerCase() === account.value?.email.toLowerCase()

  const members = computed(() => {
    const message = summary()
    if (!message) return []
    return prefs.value.threading ? thread(message) : [message]
  })

  let asked = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function fetchReplies(message: MessageSummary, folder: string) {
    const subject = threadSubject(message.subject)
    const current = ++asked
    const key = `${account.value?.email}\0${subject}`
    let known = sentReplies.get(key)
    if (!known || Date.now() - known.at > SENT_FRESH) {
      try {
        // The search is by words; the same subject, give or take "Re:", is checked here
        const page = await $fetch<MessagePage>('/api/messages', { query: { folder, q: subject.slice(0, 200) } })
        known = { at: Date.now(), messages: page.messages.filter(item => threadSubject(item.subject) === subject) }
        sentReplies.set(key, known)
      } catch {
        // The conversation simply shows without your replies
        return
      }
    }
    if (current === asked) replies.value = known.messages
  }

  watch(() => {
    const message = summary()
    return [message?.id, message?.folder, message?.subject, prefs.value.threading, sent.value?.path] as const
  }, () => {
    clearTimeout(timer)
    asked++
    replies.value = []
    const message = summary()
    const folder = sent.value?.path
    // In Sent itself the replies are already the list; a subject of a word or less matches anything
    if (!message || !folder || !prefs.value.threading || message.folder === folder || threadSubject(message.subject).length < 4) return
    const known = sentReplies.get(`${account.value?.email}\0${threadSubject(message.subject)}`)
    if (known && Date.now() - known.at <= SENT_FRESH) replies.value = known.messages
    // Not while stepping through the list with j and k: only for a message that stays open
    else timer = setTimeout(() => fetchReplies(message, folder), 350)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(timer))

  const entries = computed<ThreadEntry[]>(() => {
    const list = members.value
    if (!list.length) return []
    // A reply of yours belongs here when it went to someone in the conversation
    const people = new Set(list.flatMap(item => [item.from, ...item.to]).filter(address => !own(address)).map(address => address.address.toLowerCase()))
    const has = (candidate: MessageSummary) => list.some(item => messageKey(item) === messageKey(candidate) || (!!item.messageId && item.messageId === candidate.messageId))
    const mine = replies.value.filter(item => !has(item) && item.to.some(address => people.has(address.address.toLowerCase())))
    return [...list, ...mine]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({ summary: item, mine: own(item.from) || item.folder === sent.value?.path }))
  })

  return { entries, isThread: computed(() => entries.value.length > 1) }
}
