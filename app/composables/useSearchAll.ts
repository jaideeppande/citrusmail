import type { SearchQuery } from '~/utils/labels'

export interface SearchHit {
  message: MessageSummary
  folder: Folder
}

/** Folders asked at the same time: enough to feel quick, few enough not to crowd a mail server */
const AT_ONCE = 2

// Search across every folder. The server searches one folder per request, so
// this asks them in turn and gathers what comes back, newest first. Slower
// than a search the server does in one go, and it says how far along it is
const _useSearchAll = () => {
  const mail = useMail()
  const labels = useLabels()
  const isOpen = ref(false)
  const input = ref('')
  const hits = shallowRef<SearchHit[]>([])
  const progress = ref({ done: 0, total: 0 })
  const status = ref<'idle' | 'searching' | 'done' | 'error'>('idle')
  const recent = useAccountPref<string[]>('recent-searches', () => [])

  const query = computed(() => parseSearch(input.value))
  let run = 0

  /** Which folders a search covers: the one named with in:, or all but Trash and Junk */
  function foldersFor(parsed: SearchQuery) {
    const all = mail.folders.value.filter(folder => folder.role !== 'flagged')
    if (parsed.folder) {
      const wanted = parsed.folder.toLowerCase()
      const named = all.filter(folder => folder.name.toLowerCase() === wanted || folder.path.toLowerCase() === wanted || folder.role === wanted)
      return named.length ? named : all.filter(folder => folder.name.toLowerCase().includes(wanted))
    }
    return all.filter(folder => folder.role !== 'trash' && folder.role !== 'junk')
  }

  async function search() {
    const parsed = query.value
    const mine = ++run
    hits.value = []
    if (isEmptySearch(parsed)) {
      status.value = 'idle'
      progress.value = { done: 0, total: 0 }
      return
    }
    const folders = foldersFor(parsed)
    const label = parsed.label ? labels.labels.value.find(item => item.name.toLowerCase() === parsed.label!.toLowerCase()) : undefined
    status.value = 'searching'
    progress.value = { done: 0, total: folders.length }
    let failed = 0
    const queue = [...folders]

    async function worker() {
      for (let folder = queue.shift(); folder; folder = queue.shift()) {
        const page = await $fetch<MessagePage>('/api/messages', {
          query: {
            folder: folder.path,
            q: parsed.text || undefined,
            from: parsed.from,
            unread: parsed.unread ? 1 : undefined,
            flagged: parsed.flagged ? 1 : undefined,
            attachments: parsed.attachments ? 1 : undefined
          }
        }).catch(() => undefined)
        // Another search has started since: this one's answers are stale
        if (mine !== run) return
        if (!page) failed++
        const found = (page?.messages ?? [])
          .filter(message => matchesSearch(message, parsed) && (!parsed.label || (label && labels.has(message, label.id))))
          .map(message => ({ message, folder: folder! }))
        if (found.length) hits.value = [...hits.value, ...found].sort((a, b) => b.message.date.localeCompare(a.message.date))
        progress.value = { done: progress.value.done + 1, total: folders.length }
      }
    }
    await Promise.all(Array.from({ length: AT_ONCE }, worker))
    if (mine !== run) return
    status.value = failed === folders.length && folders.length ? 'error' : 'done'
    announce(hits.value.length ? `${hits.value.length} ${hits.value.length === 1 ? 'result' : 'results'}` : 'No results')
  }

  const start = useDebounceFn(search, 350)
  watch(input, () => {
    // What's on screen answers another question from the first keystroke on
    run++
    status.value = isEmptySearch(query.value) ? 'idle' : 'searching'
    start()
  })

  /** A search that found what was wanted is worth offering again */
  function remember() {
    const text = input.value.trim()
    if (text) recent.value = [text, ...recent.value.filter(item => item !== text)].slice(0, 8)
  }

  function forget(text: string) {
    recent.value = recent.value.filter(item => item !== text)
  }

  function open(text = '') {
    input.value = text
    isOpen.value = true
  }

  function show(hit: SearchHit) {
    remember()
    isOpen.value = false
    navigateTo({ path: folderLink(hit.message.folder), query: { m: hit.message.id } })
  }

  defineAppShortcuts({ 'mail.searchAll': { usingInput: true, handler: () => isOpen.value ? (isOpen.value = false) : open() } })

  return { isOpen, input, query, hits, progress, status, recent, open, show, forget }
}

export const useSearchAll = createAppComposable(_useSearchAll)

/** The operators the search understands, for the hint under the field */
export const SEARCH_OPERATORS = [
  { example: 'from:ana', meaning: 'who sent it' },
  { example: 'has:attachment', meaning: 'with files' },
  { example: 'is:unread', meaning: 'or is:flagged, is:read' },
  { example: 'after:2026-01-31', meaning: 'or before:' },
  { example: 'in:archive', meaning: 'one folder' },
  { example: 'label:todo', meaning: 'one of your labels' }
]
