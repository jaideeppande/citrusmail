// Triage: the Inbox one message at a time, each dealt with by a single key.
// The queue is the list as it stood when triage began, so what you decide
// never reshuffles what comes next
const _useTriage = () => {
  const mail = useMail()
  const isOpen = ref(false)
  const queue = shallowRef<MessageSummary[]>([])
  const index = ref(0)
  /** How each message left: drives which way its card slides off */
  const way = ref<'next' | 'back' | 'away'>('next')
  const done = ref({ archived: 0, deleted: 0, snoozed: 0, replied: 0 })

  const current = computed(() => queue.value[index.value])
  const finished = computed(() => isOpen.value && index.value >= queue.value.length)

  async function start() {
    if (mail.folderPath.value !== 'INBOX' && mail.folder.value?.role !== 'inbox') {
      await navigateTo(folderLink(mail.folders.value.find(folder => folder.role === 'inbox')?.path ?? 'INBOX'))
    }
    if (mail.ai.value.on) mail.exitAi()
    queue.value = [...mail.listed.value]
    index.value = 0
    done.value = { archived: 0, deleted: 0, snoozed: 0, replied: 0 }
    isOpen.value = queue.value.length > 0
  }

  function step(offset: number, how: 'next' | 'back' | 'away' = offset > 0 ? 'next' : 'back') {
    way.value = how
    index.value = Math.max(0, Math.min(queue.value.length, index.value + offset))
  }

  function close() {
    isOpen.value = false
  }

  defineAppShortcuts({ 'mail.triage': () => !isOpen.value && start() })

  return { isOpen, queue, index, way, done, current, finished, start, step, close }
}

export const useTriage = createAppComposable(_useTriage)
