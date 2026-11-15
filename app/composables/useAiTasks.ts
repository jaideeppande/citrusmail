/** Messages read in one go: more would make a long, costly prompt */
const MOST = 8
/** Each message's share of the prompt */
const PER_MESSAGE = 6000

interface ReviewTask extends AiFoundTask {
  picked: boolean
}

// Action items to tasks: reads whole messages (without marking them read),
// lists the to-dos it finds for you to check and edit, and puts the ones you
// keep on the Later board, the task as the card's note. Shared by the list,
// the bulk bar and the reader; one review dialog for the whole window
const _useAiTasks = () => {
  const ai = useAiClient()
  const cache = useMessageCache()
  const board = useLaterBoard()
  const { settings } = useSettings()
  const { account } = useShell()

  const isOpen = ref(false)
  const status = ref<'idle' | 'finding' | 'done' | 'error'>('idle')
  const error = ref('')
  const messages = shallowRef<MessageSummary[]>([])
  const tasks = ref<ReviewTask[]>([])
  let controller: AbortController | undefined

  const on = computed(() => ai.enabled('tasks'))

  const today = () => {
    const now = new Date()
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return `${now.toLocaleDateString('en-GB', { weekday: 'long' })} ${day}`
  }

  /** Finds the to-dos in these messages and opens the review */
  async function extract(list: MessageSummary[]) {
    if (!list.length) return
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    messages.value = list.slice(0, MOST)
    tasks.value = []
    error.value = ''
    status.value = 'finding'
    isOpen.value = true
    try {
      const details = await Promise.all(messages.value.map(message => cache.peek(message.folder, message.id).then(entry => entry.message)))
      if (signal.aborted) return
      const answer = await ai.json({
        feature: 'tasks',
        system: tasksSystem(today(), languageName(settings.value.language || 'en'), account.value?.email),
        prompt: tasksPrompt(details.map(detail => messageForPrompt(detail, PER_MESSAGE))),
        maxTokens: 1200,
        effort: 'low',
        signal
      }, tasksAnswer)
      if (signal.aborted) return
      // Yours are ticked to start with; someone else's are there to see, not to add
      tasks.value = readTasks(answer, messages.value.length).map(task => ({ ...task, picked: !task.who }))
      status.value = 'done'
      announce(tasks.value.length ? `Found ${tasks.value.length} ${tasks.value.length === 1 ? 'task' : 'tasks'}` : 'No tasks found')
    } catch (failure) {
      if (signal.aborted || (failure as AiError).code === 'aborted') return
      error.value = (failure as Error).message || 'Couldn’t read the message.'
      status.value = 'error'
      announce(`Couldn’t find tasks. ${error.value}`, true)
    }
  }

  function close() {
    controller?.abort()
    isOpen.value = false
  }

  const picked = computed(() => tasks.value.filter(task => task.picked && task.text.trim()))

  /** One card per message, carrying its tasks as the note, after any note it already had */
  function addChosen() {
    const chosen = picked.value
    if (!chosen.length) return
    const sources = [...new Set(chosen.map(task => task.source))]
    const cards = sources.map(index => messages.value[index]!)
    board.add(cards, 'todo')
    for (const [at, index] of sources.entries()) {
      const key = labelKey(cards[at]!)
      const before = board.cards.value.find(card => card.key === key)?.note
      const note = taskNote(chosen.filter(task => task.source === index).map(task => ({ ...task, text: task.text.trim() })))
      board.setNote(key, before ? `${before}; ${note}` : note)
    }
    announce(`${chosen.length} ${chosen.length === 1 ? 'task' : 'tasks'} added to Later`)
    isOpen.value = false
  }

  /* The dialog is mounted by more than one place (the list, the layout); the first one alive shows it */
  const hosts = shallowRef<symbol[]>([])
  function host() {
    const me = Symbol('tasks-dialog')
    onMounted(() => (hosts.value = [...hosts.value, me]))
    onBeforeUnmount(() => (hosts.value = hosts.value.filter(item => item !== me)))
    return computed(() => hosts.value[0] === me)
  }

  return { on, isOpen, status, error, messages, tasks, picked, extract, close, addChosen, host }
}

export const useAiTasks = createAppComposable(_useAiTasks)
