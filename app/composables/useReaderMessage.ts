// One message as the reader shows it: the copy on hand at once, the server
// asked otherwise, and marked read once it is really open. The reader uses
// it for the open message and each card of a conversation for its own
export function useReaderMessage(target: () => { folder: string, id: string }, showImages: Ref<boolean>, options: { neighbours?: boolean } = {}) {
  const { messages, shown, setUnread } = useMail()
  const cache = useMessageCache()

  const message = ref<MessageDetail>()
  const status = ref<'pending' | 'success' | 'error'>('pending')
  /** The server couldn't be reached: this is the copy saved on this computer */
  const offline = ref(false)
  /** It took the skeleton's place, rather than being there from the start */
  const arrived = ref(false)

  // Ids are only unique within a folder, and an AI search match can be from any
  function row(id: string, folder: string) {
    const match = (item: MessageSummary) => item.id === id && item.folder === folder
    return shown.value.find(match) ?? messages.value.find(match)
  }

  async function load() {
    const { folder, id } = target()
    const images = showImages.value
    const same = () => target().id === id && target().folder === folder
    // The copy on hand shows at once; otherwise the server is asked
    const hit = cache.cached(folder, id, images)
    message.value = hit?.message ?? (images ? message.value : undefined)
    status.value = hit ? 'success' : 'pending'
    if (!message.value) arrived.value = true
    try {
      const entry = await cache.open(folder, id, images)
      if (!same() || showImages.value !== images) return
      message.value = entry.message
      offline.value = !!entry.offline
      status.value = 'success'
      // Opening marks it read: the server did, unless it was fetched ahead.
      // Not from a saved copy with no connection: the server couldn't be told
      const item = row(id, folder)
      if (item?.unread && !entry.offline) setUnread(item, false, entry.marked)
      // Not on this window's list (a window opened straight onto it): the
      // server marked it read all the same, and the other windows hear so
      else if (!item && entry.marked && !entry.offline) tellWindows({ type: 'mail:patch', folder, id, change: { unread: false } })
      // Only that first fetch marked it read; opened again from the copy, the server is told
      entry.marked = false
    } catch {
      if (same()) status.value = 'error'
    }
    if (!options.neighbours) return
    // The messages either side are likely next
    const index = shown.value.findIndex(row => row.id === id && row.folder === folder)
    if (index !== -1) cache.prefetch([shown.value[index + 1], shown.value[index - 1], shown.value[index + 2]].filter(row => row !== undefined))
  }

  // By value: a row that only changed its read mark is still the same message
  watch([() => target().id, () => target().folder, showImages], load, { immediate: true })

  return { message, status, offline, arrived, refresh: load, row }
}
