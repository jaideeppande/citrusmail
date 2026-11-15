import type { Thread } from '~/utils/threads'

/** How long a move or delete can still be taken back before the server is told */
const UNDO_MS = 5000
/** A row's way out of the list, matched by `lb-row-leaving` in the stylesheet */
const LEAVE_MS = 170

interface ServerCall {
  url: string
  method: 'POST' | 'DELETE'
  query: Record<string, string>
  body?: Record<string, unknown>
}

interface PendingAction {
  calls: ServerCall[]
  undo: () => void
  timer: ReturnType<typeof setTimeout>
  toast: string | number
}

// Folders, the open folder's messages and every action on them. Actions are
// optimistic: the list changes first and is put back if the server refuses.
// Moving and deleting wait a few seconds before the server hears of them, so
// Undo is always a matter of not sending the request
const _useMail = () => {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const prefs = usePrefs()
  const marks = useMailMarks()

  const { data: folders, refresh: refreshFolders } = useFetch<Folder[]>('/api/folders', {
    key: 'folders',
    default: () => [],
    server: false
  })

  const folderPath = computed(() => route.path.startsWith('/mail/') ? (route.params.folder as string || 'INBOX') : 'INBOX')
  const folder = computed(() => folders.value.find(item => item.path === folderPath.value))

  const search = ref('')
  const query = refDebounced(search, 300)
  const filter = ref<'all' | 'unread' | 'flagged'>('all')
  // Narrowing a search: who sent it, when, and whether it has files
  const filters = ref<MailFilters>({})
  const filtering = computed(() => Boolean(filters.value.from || filters.value.within || filters.value.on || filters.value.attachments))
  const filterFrom = refDebounced(computed(() => filters.value.from?.trim() || undefined), 300)

  function listQuery() {
    return {
      folder: folderPath.value,
      unread: filter.value === 'unread' ? 1 : undefined,
      flagged: filter.value === 'flagged' ? 1 : undefined,
      from: filterFrom.value,
      within: filters.value.within,
      on: filters.value.on,
      attachments: filters.value.attachments ? 1 : undefined
    }
  }

  // The last page seen of each folder, shown at once while the server is
  // asked again: on a slow mail server that's the difference between an
  // instant folder and seconds of skeletons
  const { account: shellAccount } = useShell()
  const listCache = useLocalStorage<Record<string, { at: number, page: MessagePage }>>('citrusmail-list-cache', {})
  const cacheKey = () => JSON.stringify([shellAccount.value?.email, listQuery(), query.value || ''])
  function cachePage(page: MessagePage) {
    const entries = Object.entries({ ...listCache.value, [cacheKey()]: { at: Date.now(), page: { ...page, messages: page.messages.slice(0, 50) } } })
    listCache.value = Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, 10))
  }

  const messages = ref<MessageSummary[]>([])
  const total = ref(0)
  // The newest few are the likeliest to be opened: fetched ahead, still unread
  const { prefetch } = useMessageCache()
  const cursor = ref<string>()
  /** 'refreshing': a saved copy is on screen while the server is asked again */
  const status = ref<'idle' | 'loading' | 'refreshing' | 'more' | 'error'>('idle')

  // A request counter so a slow response for a folder already left behind
  // never lands in the one on screen
  let generation = 0

  // Messages just moved or deleted. A list request already on its way can
  // still name them; they stay off the list until the server has caught up
  const leaving = new Set<string>()
  const leaveKey = messageKey
  // Rows playing their way out, and rows that just came in, for the list to animate
  const vanishing = ref(new Set<string>())
  const arrived = ref(new Set<string>())
  const staying = (message: MessageSummary) => !leaving.has(leaveKey(message))

  async function load(reset = true) {
    if (!reset && (!cursor.value || status.value !== 'idle')) return

    const current = ++generation
    const cached = reset ? listCache.value[cacheKey()]?.page : undefined
    if (cached) {
      messages.value = cached.messages.filter(staying)
      total.value = cached.total
      cursor.value = undefined
    }
    status.value = cached ? 'refreshing' : reset ? 'loading' : 'more'

    try {
      const page = await $fetch<MessagePage>('/api/messages', {
        query: {
          ...listQuery(),
          before: reset ? undefined : cursor.value,
          q: query.value || undefined
        }
      })
      if (current !== generation) return

      const arrived = page.messages.filter(staying)
      messages.value = reset ? arrived : [...messages.value, ...arrived]
      total.value = page.total
      cursor.value = page.cursor
      status.value = 'idle'
      if (reset) {
        cachePage(page)
        prefetch(arrived.slice(0, 3).map(message => ({ folder: message.folder, id: message.id })))
      }
    } catch {
      // A cached page stays up when the server can't be reached
      if (current === generation) status.value = cached ? 'idle' : 'error'
    }
  }

  // New mail arrives at the top: fetch the first page again and put any
  // message not on screen yet in front, without disturbing the scroll
  async function refreshTop() {
    if (status.value !== 'idle' || query.value) return

    try {
      // Rules file new mail first, so it never flashes up in the Inbox
      const { moved } = await $fetch<{ moved: number }>('/api/rules/run', { method: 'POST' }).catch(() => ({ moved: 0 }))
      if (moved && folderPath.value === 'INBOX') {
        refreshFolders()
        return load()
      }
      const current = generation
      const page = await $fetch<MessagePage>('/api/messages', { query: listQuery() })
      // The folder was left while this was on its way
      if (current !== generation) return
      const known = new Set(messages.value.map(message => message.id))
      const fresh = page.messages.filter(message => !known.has(message.id) && staying(message))
      if (fresh.length) {
        // In date order, so a message moved in from another folder lands among its own day's mail
        messages.value = [...fresh, ...messages.value].sort((a, b) => b.date.localeCompare(a.date))
        total.value = page.total
        // They settle in rather than appear, and other windows hear of them too
        arrived.value = new Set(fresh.map(messageKey))
        setTimeout(() => (arrived.value = new Set()), 600)
      }
      refreshFolders()
    } catch {
      // Background refresh, the next tick tries again
    }
  }

  const visibility = useDocumentVisibility()
  // Reading, flagging and moving show up in the saved copy too
  watchDebounced(messages, (list) => {
    if (status.value !== 'idle' || !list.length) return
    cachePage({ messages: list.slice(0, 50), total: total.value, cursor: undefined })
  }, { debounce: 800, deep: true })

  const poll = useIntervalFn(refreshTop, 30_000, { immediate: false })
  watch(visibility, visible => visible === 'visible' ? (refreshTop(), poll.resume()) : poll.pause())

  // Opening a folder leaves AI search
  watch(folderPath, () => ai.value.on && exitAi())

  watch([folderPath, query, filter, filterFrom, () => filters.value.within, () => filters.value.on, () => filters.value.attachments], () => {
    if (route.path.startsWith('/mail')) load()
  })

  onNuxtReady(() => {
    // The list first; rules then file whatever came in while CitrusMail was
    // closed, and the list follows if they moved anything
    if (route.path.startsWith('/mail')) load()
    $fetch<{ moved: number }>('/api/rules/run', { method: 'POST' })
      .then(({ moved }) => {
        if (!moved) return
        refreshFolders()
        if (route.path.startsWith('/mail')) load()
      })
      .catch(() => {})
    poll.resume()
  })

  // The open message's id, and its folder when it isn't the one on screen (an
  // AI search match): ids are only unique within a folder
  const selectedId = computed<string | undefined>({
    get: () => route.query.m as string | undefined,
    set: (id) => {
      router.replace({ query: { ...route.query, m: id || undefined, f: undefined } })
    }
  })
  const selectedFolder = computed(() => (route.query.f as string | undefined) ?? folderPath.value)
  const isSelected = (message: MessageSummary) => message.id === selectedId.value && message.folder === selectedFolder.value
  function select(message: MessageSummary) {
    router.replace({ query: { ...route.query, m: message.id, f: message.folder === folderPath.value ? undefined : message.folder } })
  }

  /* AI search ------------------------------------------------------ */

  // A question asked of every folder at once. While it's on, its matches
  // take the list's place; they can come from any folder
  const ai = ref<{ on: boolean, status: 'idle' | 'loading' | 'done' | 'error', query: string, result?: AiSearchResult, error?: string }>({ on: false, status: 'idle', query: '' })

  async function askAi(question: string) {
    const q = question.trim()
    if (q.length < 2) return
    ai.value = { on: true, status: 'loading', query: q }
    try {
      const result = await $fetch<AiSearchResult>('/api/ai/search', { method: 'POST', body: { q } })
      if (ai.value.query === q) ai.value = { on: true, status: 'done', query: q, result }
    } catch (error) {
      if (ai.value.query !== q) return
      ai.value = { on: true, status: 'error', query: q, error: (error as { data?: { message?: string } }).data?.message ?? 'The search didn’t finish. Try again.' }
    }
  }

  function exitAi() {
    ai.value = { on: false, status: 'idle', query: '' }
  }

  /** What the list shows: the folder, or AI search's matches */
  const shown = computed(() => ai.value.on ? ai.value.result?.messages ?? [] : listed.value)

  const selected = computed(() => shown.value.find(isSelected) ?? messages.value.find(isSelected))

  /* Conversations, pins, snoozes and the Inbox tabs -------------------- */

  // The Inbox tabs lean on sender lists and contacts, which in turn lean on
  // this composable, so the layout hands them over once both exist
  const organise = shallowRef<ReturnType<typeof useInboxTabs>>()
  const inInbox = computed(() => folder.value?.role === 'inbox' || folderPath.value === 'INBOX')
  const tabbed = computed(() => inInbox.value && !!organise.value?.enabled.value && !query.value && !filtering.value)

  // Messages you track show up in the Inbox's Tracked tab, though they live in Sent
  const tracked = ref<MessageSummary[]>([])
  async function loadTracked() {
    const sent = folders.value.find(item => item.role === 'sent')
    if (!sent) return
    const page = await $fetch<MessagePage>('/api/messages', { query: { folder: sent.path } }).catch(() => undefined)
    if (page) tracked.value = page.messages.filter(message => message.receipt)
  }
  watch(() => tabbed.value && organise.value?.tab.value === 'tracked', on => on && loadTracked())

  const threading = computed(() => prefs.value.threading)
  const threads = computed(() => threading.value ? groupThreads(messages.value) : [])
  const threadOf = computed(() => {
    const map = new Map<string, Thread>()
    for (const item of threads.value) for (const message of item.messages) map.set(messageKey(message), item)
    return map
  })

  /** The conversation a message belongs to among those loaded, oldest first */
  function thread(message: MessageSummary): MessageSummary[] {
    return threadOf.value.get(messageKey(message))?.messages ?? [message]
  }
  /** How many messages its row stands for, and whether any is unread or flagged */
  function threadInfo(message: MessageSummary): Thread | undefined {
    const found = threadOf.value.get(messageKey(message))
    return found && found.messages.length > 1 ? found : undefined
  }

  // One label at a time narrows the folder to the messages that carry it
  const labels = useLabels()
  const labelFilter = ref<string>()
  watch(labels.labels, (all) => {
    if (labelFilter.value && !all.some(label => label.id === labelFilter.value)) labelFilter.value = undefined
  })

  /** The folder as it's listed: one row per conversation, pins first, snoozed mail left out */
  const listed = computed(() => {
    if (tabbed.value && organise.value!.tab.value === 'tracked') return tracked.value
    let list = messages.value.filter(message => !marks.isSnoozed(message))
    if (labelFilter.value) list = list.filter(message => labels.has(message, labelFilter.value!))
    if (tabbed.value) list = list.filter(organise.value!.accepts)
    if (threading.value) {
      const heads = new Set<string>()
      list = list.filter((message) => {
        const head = threadOf.value.get(messageKey(message))?.head ?? message
        const key = messageKey(head)
        // A conversation shows once, where its newest message that passed the filters stands
        if (heads.has(key)) return false
        heads.add(key)
        return true
      }).map(message => threadOf.value.get(messageKey(message))?.head ?? message)
    }
    // Pinned first, then what's back from a snooze; the rest keep their order
    const rank = (message: MessageSummary) => {
      const all = thread(message)
      return all.some(marks.isPinned) ? 0 : all.some(marks.isReturned) ? 1 : 2
    }
    const ranks = new Map(list.map(message => [message, rank(message)]))
    return ranks.size && [...ranks.values()].some(value => value < 2)
      ? [...list].sort((a, b) => ranks.get(a)! - ranks.get(b)!)
      : list
  })

  /** A conversation's row is selected while any of its messages is open */
  function isRowSelected(message: MessageSummary) {
    if (isSelected(message)) return true
    return !!selectedId.value && thread(message).some(isSelected)
  }

  // Ids are only unique within a folder, and AI search shows several at once
  function patchLocal(id: string, change: Partial<MessageSummary>, folder?: string, heard = false) {
    const hit = (message: MessageSummary) => message.id === id && (!folder || message.folder === folder)
    // Other windows show the same change, unless this is one of theirs
    if (!heard && folder) tellWindows({ type: 'mail:patch', folder, id, change })
    messages.value = messages.value.map(message => hit(message) ? { ...message, ...change } : message)
    tracked.value = tracked.value.map(message => hit(message) ? { ...message, ...change } : message)
    if (ai.value.result) {
      ai.value.result = { ...ai.value.result, messages: ai.value.result.messages.map(message => hit(message) ? { ...message, ...change } : message) }
    }
  }

  function adjustUnread(path: string, delta: number) {
    folders.value = folders.value.map(item => item.path === path ? { ...item, unread: Math.max(0, item.unread + delta) } : item)
  }

  async function setUnread(message: MessageSummary, unread: boolean, silent = false) {
    if (message.unread === unread) return
    patchLocal(message.id, { unread }, message.folder)
    adjustUnread(message.folder, unread ? 1 : -1)

    if (silent) return
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'PATCH', query: { folder: message.folder }, body: { unread } })
    } catch {
      patchLocal(message.id, { unread: !unread }, message.folder)
      adjustUnread(message.folder, unread ? -1 : 1)
      toast.add({ title: 'Couldn’t update the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function toggleFlag(message: MessageSummary) {
    const flagged = !message.flagged
    patchLocal(message.id, { flagged }, message.folder)
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'PATCH', query: { folder: message.folder }, body: { flagged } })
    } catch {
      patchLocal(message.id, { flagged: !flagged }, message.folder)
      toast.add({ title: 'Couldn’t flag the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  // Takes the message off the list and selects its neighbour, the way a
  // reader expects to keep going down the inbox
  function takeOut(message: MessageSummary, heard = false) {
    const same = (item: MessageSummary) => item.id === message.id && item.folder === message.folder
    const index = messages.value.findIndex(same)
    const row = shown.value.findIndex(isRowSelected)
    const wasSelected = isSelected(message)
    const key = leaveKey(message)
    leaving.add(key)
    setTimeout(() => leaving.delete(key), 60_000)
    if (!heard) tellWindows({ type: 'mail:gone', folder: message.folder, id: message.id })
    messages.value = messages.value.filter(item => !same(item))
    tracked.value = tracked.value.filter(item => !same(item))
    const aiIndex = ai.value.result?.messages.findIndex(same) ?? -1
    if (ai.value.result) ai.value.result = { ...ai.value.result, messages: ai.value.result.messages.filter(item => !same(item)) }
    if (index !== -1) total.value = Math.max(0, total.value - 1)
    if (message.unread) adjustUnread(message.folder, -1)
    if (wasSelected) {
      // The row that took its place, or the one before it at the end of the list
      const next = shown.value[row] ?? shown.value[row - 1]
      if (next) select(next)
      else selectedId.value = undefined
    }
    return () => {
      leaving.delete(key)
      // An AI search match from another folder was never on this folder's list
      if (index !== -1) {
        messages.value.splice(index, 0, message)
        total.value++
      }
      if (aiIndex !== -1 && ai.value.result) {
        const back = [...ai.value.result.messages]
        back.splice(aiIndex, 0, message)
        ai.value.result = { ...ai.value.result, messages: back }
      }
      if (message.unread) adjustUnread(message.folder, 1)
    }
  }

  /** Lets the rows play their way out before the list closes up behind them */
  async function vanish(list: MessageSummary[]) {
    if (document.documentElement.dataset.motion !== 'full' || document.hidden) return
    // A conversation leaves as its one row
    vanishing.value = new Set([...list, ...list.map(message => threadOf.value.get(messageKey(message))?.head ?? message)].map(messageKey))
    await new Promise(resolve => setTimeout(resolve, LEAVE_MS))
    vanishing.value = new Set()
  }

  /* Selecting several -------------------------------------------------- */

  // Rows ticked for a bulk action, apart from the one message that's open.
  // While any are ticked, the keys that act on a message act on all of them
  const checked = ref(new Set<string>())
  const checkedRows = computed(() => checked.value.size ? shown.value.filter(message => checked.value.has(messageKey(message))) : [])
  const isChecked = (message: MessageSummary) => checked.value.has(messageKey(message))
  let anchor: string | undefined

  /** Ticks or unticks a row; with `range`, everything from the last one ticked to this one */
  function check(message: MessageSummary, range = false) {
    const key = messageKey(message)
    const next = new Set(checked.value)
    const from = range && anchor ? shown.value.findIndex(item => messageKey(item) === anchor) : -1
    const to = shown.value.findIndex(item => messageKey(item) === key)
    if (from !== -1 && to !== -1) {
      for (const item of shown.value.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(messageKey(item))
    } else if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    anchor = key
    checked.value = next
    announce(next.size ? `${next.size} selected` : 'Selection cleared')
  }

  function checkAll() {
    checked.value = checked.value.size === shown.value.length ? new Set() : new Set(shown.value.map(messageKey))
  }

  function clearChecked() {
    if (checked.value.size) checked.value = new Set()
    anchor = undefined
  }

  // A row that left the list can't stay ticked, and another folder starts clean
  watch(shown, (rows) => {
    if (!checked.value.size) return
    const present = new Set(rows.map(messageKey))
    const kept = [...checked.value].filter(key => present.has(key))
    if (kept.length !== checked.value.size) checked.value = new Set(kept)
  })
  watch(folderPath, clearChecked)

  /** What a key or a button acts on: the ticked rows, or else the open message */
  function acting(): MessageSummary[] {
    if (checkedRows.value.length) return checkedRows.value
    return selected.value ? [selected.value] : []
  }

  /* Undo -------------------------------------------------------------- */

  // What's been done on screen but not yet on the server. Undo drops the
  // request; otherwise it goes out when the toast runs down, or at once if
  // the window is closing
  const pending: PendingAction[] = []

  function request(call: ServerCall) {
    return $fetch(call.url, { method: call.method, query: call.query, body: call.body })
  }

  async function commit(action: PendingAction) {
    const index = pending.indexOf(action)
    if (index === -1) return
    pending.splice(index, 1)
    clearTimeout(action.timer)
    const results = await Promise.allSettled(action.calls.map(request))
    if (results.some(result => result.status === 'rejected')) {
      // Some may have gone through: the server is asked what's really there
      toast.add({ title: action.calls.length > 1 ? 'Some messages couldn’t be moved' : 'Couldn’t move the message', color: 'error', icon: 'i-lucide-circle-alert' })
      await load()
    }
    refreshFolders()
    tellWindows({ type: 'mail:refresh' })
  }

  function later(title: string, icon: string, calls: ServerCall[], restore: () => void) {
    const action: PendingAction = {
      calls,
      undo: () => {
        const index = pending.indexOf(action)
        if (index === -1) return
        pending.splice(index, 1)
        clearTimeout(action.timer)
        restore()
        toast.remove(action.toast)
        playUiSound('undo')
        announce('Undone')
        tellWindows({ type: 'mail:refresh' })
      },
      timer: setTimeout(() => commit(action), UNDO_MS),
      toast: ''
    }
    announce(`${title}. Press ${useShortcutKeys().kbds('mail.undo').join(' ')} to undo`)
    action.toast = toast.add({
      title,
      icon,
      duration: UNDO_MS,
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => action.undo() }]
    }).id
    pending.push(action)
  }

  /** Takes back the last move or delete, while it still can be */
  function undo() {
    pending[pending.length - 1]?.undo()
  }

  // Closing the window with something still waiting sends it on its way
  useEventListener(window, 'pagehide', () => {
    for (const action of pending.splice(0)) {
      clearTimeout(action.timer)
      for (const call of action.calls) {
        const url = `${call.url}?${new URLSearchParams(call.query)}`
        fetch(url, { method: call.method, keepalive: true, headers: call.body ? { 'content-type': 'application/json' } : undefined, body: call.body ? JSON.stringify(call.body) : undefined }).catch(() => {})
      }
    }
  })

  const MOVE_LABELS: Record<string, string> = { archive: 'Archived', trash: 'Moved to Trash', junk: 'Moved to Junk', inbox: 'Moved to Inbox' }
  const counted = (count: number, one: string) => count === 1 ? one : `${count} ${one.charAt(0).toLowerCase()}${one.slice(1)}`

  /** Every message a row stands for: a conversation moves as one */
  function withThreads(list: MessageSummary[]) {
    const all = new Map<string, MessageSummary>()
    for (const message of list) for (const member of thread(message)) all.set(messageKey(member), member)
    return [...all.values()]
  }

  async function moveMany(list: MessageSummary[], to: string) {
    // Already there (`e` in Archive): the server would do nothing and the row would vanish anyway
    const going = withThreads(list).filter(message => message.folder !== to && folders.value.find(item => item.path === message.folder)?.role !== to)
    if (!going.length) return
    await vanish(going)
    const restores = going.map(message => takeOut(message))
    marks.forget(going)
    const target = folders.value.find(item => item.path === to)
    playUiSound('archive')
    later(
      counted(going.length, MOVE_LABELS[to] ?? `Moved to ${target?.name ?? to}`),
      'i-lucide-check',
      going.map(message => ({ url: `/api/messages/${encodeURIComponent(message.id)}/move`, method: 'POST', query: { folder: message.folder }, body: { to } })),
      // Last out, first back, so each lands where it was
      () => [...restores].reverse().forEach(restore => restore())
    )
  }

  async function removeMany(list: MessageSummary[]) {
    const going = withThreads(list)
    if (!going.length) return
    await vanish(going)
    const restores = going.map(message => takeOut(message))
    marks.forget(going)
    const from = folders.value.find(item => item.path === going[0]!.folder)
    const forGood = from?.role === 'trash' || !folders.value.some(item => item.role === 'trash')
    playUiSound('archive')
    later(
      counted(going.length, forGood ? 'Deleted for good' : 'Moved to Trash'),
      'i-lucide-trash-2',
      going.map(message => ({ url: `/api/messages/${encodeURIComponent(message.id)}`, method: 'DELETE', query: { folder: message.folder } })),
      () => [...restores].reverse().forEach(restore => restore())
    )
  }

  const move = (message: MessageSummary, to: string) => moveMany([message], to)
  const remove = (message: MessageSummary) => removeMany([message])

  async function setUnreadMany(list: MessageSummary[], unread: boolean) {
    await Promise.all(withThreads(list).map(message => setUnread(message, unread)))
  }

  async function flagMany(list: MessageSummary[], flagged: boolean) {
    await Promise.all(list.filter(message => message.flagged !== flagged).map(toggleFlag))
  }

  /* Snooze and pins --------------------------------------------------- */

  async function snooze(list: MessageSummary[], until: Date) {
    const going = withThreads(list)
    if (!going.length) return
    await vanish(going)
    // The open message closes: its row is about to leave the list
    if (going.some(isSelected)) {
      const row = shown.value.findIndex(isRowSelected)
      const next = shown.value[row + 1] ?? shown.value[row - 1]
      if (next && !going.includes(next)) select(next)
      else selectedId.value = undefined
    }
    marks.snooze(going, until)
    playUiSound('snooze')
    announce(counted(going.length, `Snoozed until ${snoozeLabel(until)}`))
    const keys = going.map(messageKey)
    toast.add({
      title: counted(going.length, `Snoozed until ${snoozeLabel(until)}`),
      icon: 'i-lucide-alarm-clock',
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => marks.wake(keys) }]
    })
  }

  // Back from a snooze: at the top, unread again, the way it first arrived
  marks.onWoke(({ due }) => {
    for (const { message } of due) {
      const row = messages.value.find(item => item.id === message.id && item.folder === message.folder)
      if (row && !row.unread) setUnread(row, true)
    }
    const first = due[0]!.message
    const centre = useNotificationCentre()
    for (const { message } of due) {
      centre.push({ kind: 'snooze', title: 'Back from snooze', body: message.subject || '(No subject)', to: `${folderLink(message.folder)}?m=${encodeURIComponent(message.id)}`, key: `snooze:${messageKey(message)}` })
    }
    toast.add({
      title: due.length === 1 ? `Back from snooze: ${first.subject || '(No subject)'}` : `${due.length} messages are back from snooze`,
      icon: 'i-lucide-alarm-clock-check',
      actions: [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => navigateTo({ path: folderLink(first.folder), query: { m: first.id } }) }]
    })
  })

  // Opening a returned message is what it came back for
  watch(selected, message => message && marks.clearReturned(message))

  /* Other windows ------------------------------------------------------ */

  onWindowEvent((event) => {
    if (event.type === 'mail:patch') {
      const row = messages.value.find(item => item.id === event.id && item.folder === event.folder)
      if (row && event.change.unread !== undefined && row.unread !== event.change.unread) adjustUnread(event.folder, event.change.unread ? 1 : -1)
      patchLocal(event.id, event.change, event.folder, true)
    } else if (event.type === 'mail:gone') {
      const row = messages.value.find(item => item.id === event.id && item.folder === event.folder)
      if (row) takeOut(row, true)
    } else if (event.type === 'mail:refresh') {
      // Whatever that window took out is settled now: moved for real, or put back
      leaving.clear()
      refreshFolders()
      if (route.path.startsWith('/mail') && status.value === 'idle') load()
    }
  })

  // From a message's date: the Inbox, narrowed to that day
  async function showDay(iso: string) {
    const date = new Date(iso)
    const on = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    search.value = ''
    filter.value = 'all'
    filters.value = { on }
    // The open message stays open when it's already in the Inbox
    if (folderPath.value !== 'INBOX') await navigateTo(folderLink('INBOX'))
  }

  /* Folders ------------------------------------------------------- */

  const failed = (title: string) => (error: unknown) => {
    const description = (error as { data?: { message?: string } }).data?.message
    toast.add({ title, description, color: 'error', icon: 'i-lucide-circle-alert' })
    return undefined
  }

  async function createFolder(name: string, parent?: string): Promise<string | undefined> {
    const result = await $fetch<{ path: string }>('/api/folders', { method: 'POST', body: { name, parent } }).catch(failed('Couldn’t create the folder'))
    if (!result) return undefined
    await refreshFolders()
    toast.add({ title: `Created ${name}`, icon: 'i-lucide-folder-plus' })
    return result.path
  }

  async function renameFolder(target: Folder, name: string) {
    const result = await $fetch<{ path: string }>('/api/folders', { method: 'PATCH', body: { path: target.path, name } }).catch(failed('Couldn’t rename the folder'))
    if (!result) return
    await refreshFolders()
    if (folderPath.value === target.path) await navigateTo(folderLink(result.path))
  }

  async function deleteFolder(target: Folder) {
    const done = await $fetch<{ moved: number }>('/api/folders', { method: 'DELETE', query: { path: target.path } }).catch(failed('Couldn’t delete the folder'))
    if (!done) return
    if (folderPath.value === target.path) await navigateTo(folderLink('INBOX'))
    else if (folderPath.value === 'INBOX' && done.moved) await load()
    await refreshFolders()
    toast.add({
      title: `Deleted ${target.name}`,
      description: done.moved ? `${done.moved} ${done.moved === 1 ? 'message is' : 'messages are'} back in your Inbox.` : undefined,
      icon: 'i-lucide-folder-x'
    })
  }

  // j/k and the arrows walk the list, the rest act on the open message
  function step(offset: number) {
    const index = shown.value.findIndex(isRowSelected)
    const next = shown.value[index === -1 ? 0 : index + offset]
    if (next) select(next)
    if (!ai.value.on && offset > 0 && index >= messages.value.length - 5) load(false)
  }

  const onMail = () => route.path.startsWith('/mail')
  // Not while a menu, list or dialog is open: its own keys (typeahead, arrows)
  // would otherwise also archive, flag or step to the next message behind it
  // (The phone's reader is a slideover, which is the mail itself, not over it)
  const overlayOpen = () => !!document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]:not(:has([data-reader]))')
  const when = (handler: () => void) => () => onMail() && !overlayOpen() && handler()
  const withSelected = (handler: (message: MessageSummary) => void) => when(() => selected.value && handler(selected.value))
  const withActing = (handler: (list: MessageSummary[]) => void) => when(() => {
    const list = acting()
    if (list.length) handler(list)
  })

  // Off the mail pages none of these are held, so the arrows scroll the page again
  const mailKeys = {
    'mail.next': when(() => step(1)),
    'mail.prev': when(() => step(-1)),
    'mail.archive': withActing(list => moveMany(list, 'archive')),
    'mail.delete': withActing(removeMany),
    'mail.flag': withActing(list => flagMany(list, !list.every(message => message.flagged))),
    // Both ways, as the menus that show it say
    'mail.toggleRead': withActing(list => setUnreadMany(list, !list.some(message => message.unread))),
    'mail.pin': withSelected((message) => {
      marks.togglePin(message)
      announce(marks.isPinned(message) ? 'Pinned to top' : 'Unpinned')
    }),
    'mail.label': withActing(list => useLabelPicker().pick(list)),
    'mail.select': withSelected(message => check(threadOf.value.get(messageKey(message))?.head ?? message)),
    'mail.selectAll': when(checkAll),
    'mail.undo': when(undo)
  }
  defineAppShortcuts(() => route.path.startsWith('/mail') ? mailKeys : {})

  // Escape closes the open message. A plain listener, not a shortcut: those
  // cancel the key, and an open menu or dialog has to get it first
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || (!selectedId.value && !checked.value.size) || !onMail()) return
    const target = event.target as HTMLElement | null
    // A key passed on from inside a message arrives on the document itself
    if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
    if (document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]')) return
    // Ticked rows let go first; the next Escape closes the message
    if (checked.value.size) return clearChecked()
    selectedId.value = undefined
  })

  // Switching to the list alone shows the list: the message open beside it
  // would otherwise take the whole sheet, as if the switch had opened it
  const { view } = useMailLayout()
  watch(view, (now, before) => {
    if (now === 'list' && before === 'split' && selectedId.value) selectedId.value = undefined
  })

  return {
    folders,
    refreshFolders,
    folderPath,
    folder,
    search,
    filter,
    filters,
    filtering,
    showDay,
    createFolder,
    renameFolder,
    deleteFolder,
    messages,
    listed,
    thread,
    threadInfo,
    isRowSelected,
    vanishing,
    arrived,
    total,
    cursor,
    status,
    load,
    refreshTop,
    selectedId,
    selectedFolder,
    isSelected,
    select,
    selected,
    shown,
    ai,
    askAi,
    exitAi,
    patchLocal,
    setUnread,
    toggleFlag,
    move,
    remove,
    moveMany,
    removeMany,
    setUnreadMany,
    flagMany,
    undo,
    checked,
    checkedRows,
    isChecked,
    check,
    checkAll,
    clearChecked,
    acting,
    inboxTabs: organise,
    labelFilter,
    tabbed,
    snooze,
    togglePin: marks.togglePin,
    isPinned: marks.isPinned,
    isReturned: marks.isReturned
  }
}

export const useMail = createAppComposable(_useMail)
