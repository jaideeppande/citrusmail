export type NoticeKind = 'mail' | 'snooze' | 'nudge' | 'failed' | 'info'

export interface Notice {
  id: string
  kind: NoticeKind
  title: string
  body?: string
  /** ms since epoch */
  at: number
  read: boolean
  /** Where its action goes: a path within the app */
  to?: string
  /** The mailbox it belongs to, when that isn't the open one */
  mailbox?: string
  /** Two notices with the same key are one: the newer replaces the older */
  key?: string
}

const KEEP = 60

export const NOTICE_ICONS: Record<NoticeKind, string> = {
  mail: 'i-lucide-mail',
  snooze: 'i-lucide-alarm-clock-check',
  nudge: 'i-lucide-hourglass',
  failed: 'i-lucide-mail-warning',
  info: 'i-lucide-info'
}

// The notification centre: what the app told you, kept so a toast you missed
// isn't gone for good. New mail, snoozes that came back, messages nobody
// answered, and messages that couldn't be sent. On this computer, shared by
// every window, for every signed-in mailbox together
const _useNotificationCentre = () => {
  const { account } = useShell()
  const notices = useLocalPref<Notice[]>('notices', [])
  const isOpen = ref(false)

  const unread = computed(() => notices.value.filter(notice => !notice.read).length)

  function push(notice: Omit<Notice, 'id' | 'at' | 'read'> & { at?: number }) {
    const made: Notice = { ...notice, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: notice.at ?? Date.now(), read: false }
    notices.value = [made, ...notices.value.filter(item => !made.key || item.key !== made.key)].slice(0, KEEP)
  }

  function markRead(id?: string) {
    notices.value = notices.value.map(notice => !id || notice.id === id ? { ...notice, read: true } : notice)
  }

  function remove(id: string) {
    notices.value = notices.value.filter(notice => notice.id !== id)
  }

  function clear() {
    notices.value = []
  }

  /** Mail that came in for each of the other mailboxes since it was last open */
  const waiting = computed(() => {
    const counts: Record<string, number> = {}
    const self = account.value?.email.toLowerCase()
    for (const notice of notices.value) {
      if (notice.kind === 'mail' && !notice.read && notice.mailbox && notice.mailbox !== self) counts[notice.mailbox] = (counts[notice.mailbox] ?? 0) + 1
    }
    return counts
  })

  // Opening a mailbox is seeing its new mail
  watch(() => account.value?.email, (email) => {
    const self = email?.toLowerCase()
    if (!self || !notices.value.some(notice => notice.mailbox === self && !notice.read)) return
    notices.value = notices.value.map(notice => notice.mailbox === self ? { ...notice, read: true } : notice)
  }, { immediate: true })

  defineAppShortcuts({ 'app.notifications': () => (isOpen.value = !isOpen.value) })

  return { notices, unread, waiting, isOpen, push, markRead, remove, clear }
}

export const useNotificationCentre = createAppComposable(_useNotificationCentre)
