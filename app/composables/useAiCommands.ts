import type { AiPlan } from '~/utils/ai-commands'

/** Folders asked at the same time, as search across folders does */
const AT_ONCE = 3
/** Pages read per folder and phrase: four of fifty reach the cap */
const PAGES = 4

/** Actions that `useMail` widens to a whole conversation */
const WHOLE_THREADS = new Set(['archive', 'delete', 'move', 'markRead', 'markUnread', 'snooze'])

export interface AiCommandOutcome {
  /** "Archive 23 messages from GitHub", once the search is done */
  description?: string
  errors: string[]
}

// Commands in plain English. The model writes a plan; the app checks it,
// runs the search itself and shows what it found in a confirmation sheet.
// Nothing changes before Confirm, and Confirm goes through the ordinary mail
// actions, so their Undo works as always
const _useAiCommands = () => {
  const ai = useAiClient()
  const mail = useMail()
  const labels = useLabels()
  const board = useLaterBoard()
  const toast = useToast()

  const isOpen = ref(false)
  const request = ref('')
  const status = ref<'planning' | 'searching' | 'ready' | 'error'>('planning')
  const errors = ref<string[]>([])
  const plan = shallowRef<AiPlan>()
  const found = shallowRef<MessageSummary[]>([])
  const chosen = ref(new Set<string>())
  const capped = ref(false)
  const progress = ref({ done: 0, total: 0 })
  let controller: AbortController | undefined

  const available = computed(() => ai.enabled('commands'))

  const state = {
    isPinned: (message: MessageSummary) => mail.isPinned(message),
    onLater: (message: MessageSummary) => board.has(message),
    hasLabel: (message: MessageSummary, id: string) => labels.has(message, id),
    get folders() {
      return mail.folders.value
    }
  }

  async function search(current: AiPlan, signal: AbortSignal) {
    const now = new Date()
    const queries = planQueries(current.search)
    const within = planWithin(current.search, now)
    const asks = current.search.folders.flatMap(folder => queries.map(q => ({ folder: folder.path, q })))
    const pooled = new Map<string, MessageSummary>()
    progress.value = { done: 0, total: asks.length }
    let full = false

    async function worker() {
      for (let ask = asks.shift(); ask && !signal.aborted; ask = asks.shift()) {
        let cursor: string | undefined
        for (let page = 0; page < PAGES && !full; page++) {
          const result = await $fetch<MessagePage>('/api/messages', {
            query: {
              folder: ask.folder,
              q: ask.q,
              from: current.search.from,
              unread: current.search.unread ? 1 : undefined,
              flagged: current.search.flagged ? 1 : undefined,
              attachments: current.search.attachments ? 1 : undefined,
              within,
              before: cursor
            },
            signal
          }).catch(() => undefined)
          if (!result || signal.aborted) break
          for (const message of result.messages) {
            if (matchesPlan(message, current.search, labels.has)) pooled.set(messageKey(message), message)
          }
          if (pooled.size >= AI_COMMAND_CAP) full = true
          cursor = result.cursor
          // Pages come newest first: past the start date, the rest is older still
          const oldest = result.messages.at(-1)?.date.slice(0, 10)
          if (!cursor || (current.search.since && oldest && oldest < current.search.since)) break
        }
        progress.value = { ...progress.value, done: progress.value.done + 1 }
      }
    }
    await Promise.all(Array.from({ length: AT_ONCE }, worker))

    let list = [...pooled.values()]
    // What Confirm will really touch: a conversation moves as one, so its other loaded messages are listed too
    if (WHOLE_THREADS.has(current.action.kind)) {
      const all = new Map<string, MessageSummary>()
      for (const message of list) for (const member of mail.thread(message)) all.set(messageKey(member), member)
      list = [...all.values()]
    }
    list = list.filter(message => changesMessage(current.action, message, state)).sort((a, b) => b.date.localeCompare(a.date))
    capped.value = full || list.length > AI_COMMAND_CAP
    return list.slice(0, AI_COMMAND_CAP)
  }

  /** Plans and searches, with the sheet open from the start to show how far it is */
  async function start(text: string): Promise<AiCommandOutcome> {
    const wanted = text.trim()
    if (!wanted) return { errors: [] }
    controller?.abort()
    const signal = (controller = new AbortController()).signal
    request.value = wanted
    status.value = 'planning'
    errors.value = []
    plan.value = undefined
    found.value = []
    chosen.value = new Set()
    capped.value = false
    isOpen.value = true

    const folders = mail.folders.value
    const context = { folders, labels: labels.labels.value.map(label => ({ id: label.id, name: label.name })), now: new Date(), request: wanted }
    try {
      const answer = await ai.json({ feature: 'commands', system: commandsSystem(context), prompt: wanted, maxTokens: 800, effort: 'low', signal }, aiPlanSchema)
      if (signal.aborted) return { errors: [] }
      const resolved = resolvePlan(answer, context)
      if (!resolved.plan) {
        errors.value = resolved.errors
        status.value = 'error'
        announce('The AI couldn’t plan that', true)
        return { errors: resolved.errors }
      }
      plan.value = resolved.plan
      status.value = 'searching'
      const list = await search(resolved.plan, signal)
      if (signal.aborted) return { errors: [] }
      found.value = list
      chosen.value = new Set(list.map(messageKey))
      status.value = 'ready'
      const description = describePlan(resolved.plan, list.length)
      announce(list.length ? `${description}. Confirm or cancel.` : 'No messages match')
      return { description: list.length ? description : 'No messages match that.', errors: [] }
    } catch (error) {
      if (signal.aborted) return { errors: [] }
      const why = error instanceof AiError ? error.message : 'Something went wrong. Try again.'
      errors.value = [why]
      status.value = 'error'
      announce(why, true)
      return { errors: [why] }
    }
  }

  /** Ticks or unticks a message, with the rest of its conversation when the action takes it all */
  function toggle(message: MessageSummary) {
    const members = plan.value && WHOLE_THREADS.has(plan.value.action.kind) ? mail.thread(message) : [message]
    const keys = [messageKey(message), ...members.map(messageKey)]
    const next = new Set(chosen.value)
    const on = !next.has(messageKey(message))
    for (const key of keys) {
      if (on) next.add(key)
      else next.delete(key)
    }
    chosen.value = next
  }

  function toggleAll() {
    chosen.value = chosen.value.size === found.value.length ? new Set() : new Set(found.value.map(messageKey))
  }

  const picked = computed(() => found.value.filter(message => chosen.value.has(messageKey(message))))
  const description = computed(() => plan.value ? describePlan(plan.value, picked.value.length) : '')
  const notes = computed(() => plan.value ? planNotes(plan.value, picked.value.length, capped.value) : [])

  /** For changes `useMail` has no Undo for: one toast that puts them back */
  function undoable(title: string, icon: string, back: () => void) {
    announce(title)
    toast.add({
      title,
      icon,
      actions: [{
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          back()
          announce('Undone')
        }
      }]
    })
  }

  async function confirm() {
    const current = plan.value
    const list = picked.value
    if (!current || !list.length || status.value !== 'ready') return
    isOpen.value = false
    const count = list.length === 1 ? '1 message' : `${list.length} messages`
    const action = current.action
    switch (action.kind) {
      case 'archive':
        return mail.moveMany(list, 'archive')
      case 'delete':
        return mail.removeMany(list)
      case 'move':
        return mail.moveMany(list, action.folder.path)
      case 'markRead':
      case 'markUnread': {
        const unread = action.kind === 'markUnread'
        await mail.setUnreadMany(list, unread)
        return undoable(`Marked ${count} as ${unread ? 'unread' : 'read'}`, unread ? 'i-lucide-mail' : 'i-lucide-mail-open', () => mail.setUnreadMany(list, !unread))
      }
      case 'flag':
      case 'unflag': {
        const flagged = action.kind === 'flag'
        await mail.flagMany(list, flagged)
        return undoable(flagged ? `Flagged ${count}` : `Removed the flag from ${count}`, 'i-lucide-flag', () => mail.flagMany(list, !flagged))
      }
      case 'label': {
        const label = action.label.id ? labels.labels.value.find(item => item.id === action.label.id) : labels.create(action.label.name)
        if (!label) return
        const going = list.filter(message => !labels.has(message, label.id))
        if (!going.length) return
        labels.toggle(going, label.id)
        return undoable(`Labelled ${count} “${label.name}”`, 'i-lucide-tag', () => labels.toggle(going, label.id))
      }
      case 'snooze':
        return mail.snooze(list, action.until)
      case 'pin': {
        const going = list.filter(message => !mail.isPinned(message))
        going.forEach(mail.togglePin)
        return undoable(`Pinned ${count} to the top`, 'i-lucide-pin', () => going.forEach(mail.togglePin))
      }
      case 'addToLater': {
        const going = list.filter(message => !board.has(message))
        board.add(going)
        return undoable(`Added ${count} to the Later board`, 'i-lucide-square-kanban', () => going.forEach(message => board.remove(labelKey(message))))
      }
      default:
        return undefined
    }
  }

  function cancel() {
    controller?.abort()
    isOpen.value = false
  }

  /** "None": a found message opened from the sheet */
  function show(message: MessageSummary) {
    isOpen.value = false
    navigateTo({ path: folderLink(message.folder), query: { m: message.id } })
  }

  return { available, isOpen, request, status, errors, plan, found, chosen, capped, progress, picked, description, notes, start, toggle, toggleAll, confirm, cancel, show }
}

export const useAiCommands = createAppComposable(_useAiCommands)
