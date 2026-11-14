// Messages already read from the server, so opening one is instant. Besides
// the ones opened, the reader fetches ahead: the messages around the open one
// and any you rest the pointer on. Those are fetched with `peek`, which leaves
// them unread until they're actually opened. A message's content never
// changes, so a copy stays good; read and flagged live on the list instead.
// The ones you opened are also saved on this computer for reading offline

const KEEP = 60
/** Fetches ahead at most this many at once, so they never crowd out what you click */
const AHEAD = 2

export interface CachedMessage {
  message: MessageDetail
  /** Whether the server marked it read when it was fetched */
  marked: boolean
  /** Read back from this computer's saved copies, not from the server in this session */
  stored?: boolean
  /** The server couldn't be reached, so this is the saved copy */
  offline?: boolean
}

type Entry = CachedMessage

/* Saved copies ------------------------------------------------------- */

// The messages opened most recently are also kept on this computer
// (IndexedDB), so they can be read again with no connection. Only the copy
// without remote images, and only for the mailbox that is signed in

interface StoredMessage {
  key: string
  account: string
  at: number
  message: MessageDetail
}

const DB = 'citrusmail-offline'
const STORE = 'messages'

let database: Promise<IDBDatabase | undefined> | undefined

function openDatabase(): Promise<IDBDatabase | undefined> {
  database ??= new Promise((resolve) => {
    // Storage can be off (private windows, blocked site data): the app just has no saved copies
    if (!import.meta.client || typeof indexedDB === 'undefined') return resolve(undefined)
    try {
      const request = indexedDB.open(DB, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(undefined)
      request.onblocked = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
  return database
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | undefined): Promise<T | undefined> {
  const db = await openDatabase()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode)
      const request = run(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => resolve(undefined)
      transaction.onabort = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

/** Forgets every message saved on this computer: for signing out */
export function clearOfflineMail() {
  return withStore('readwrite', store => store.clear())
}

const _useMessageCache = () => {
  const { account } = useShell()
  const entries = new Map<string, Entry>()
  const inFlight = new Map<string, Promise<Entry>>()
  const queue: { folder: string, id: string }[] = []
  let ahead = 0

  const keyOf = (folder: string, id: string, images: boolean) => `${account.value?.email}\0${folder}\0${id}\0${images ? 1 : 0}`

  function keep(key: string, entry: Entry) {
    entries.delete(key)
    entries.set(key, entry)
    while (entries.size > KEEP) entries.delete(entries.keys().next().value!)
  }

  // When each saved copy was last opened, to drop the oldest past KEEP
  const saved = new Map<string, number>()
  /** True once the saved copies are in memory, so `cached` can answer from them */
  const warm = ref(false)

  let restoring: Promise<void> = Promise.resolve()

  async function restore(signedOut = false) {
    const email = account.value?.email
    warm.value = false
    saved.clear()
    // Signed out: nothing of anyone's stays behind
    if (!email) return signedOut ? void clearOfflineMail() : undefined
    const all = await withStore<StoredMessage[]>('readonly', store => store.getAll()) ?? []
    if (account.value?.email !== email) return
    const mine = all.filter(item => item.account === email).sort((a, b) => a.at - b.at)
    // Another mailbox's messages don't wait here for it to come back
    const others = all.filter(item => item.account !== email)
    if (others.length) {
      withStore('readwrite', (store) => {
        others.forEach(item => store.delete(item.key))
        return undefined
      })
    }
    for (const item of mine) {
      saved.set(item.key, item.at)
      // A copy fetched in this session is at least as good
      if (!entries.has(item.key)) keep(item.key, { message: item.message, marked: false, stored: true })
    }
    warm.value = true
  }

  function save(key: string, message: MessageDetail) {
    const email = account.value?.email
    if (!email) return
    saved.delete(key)
    saved.set(key, Date.now())
    const stale = [...saved.keys()].slice(0, Math.max(0, saved.size - KEEP))
    stale.forEach(old => saved.delete(old))
    withStore('readwrite', (store) => {
      // Vue's proxies can't be cloned into the database; the object behind one can
      store.put({ key, account: email, at: Date.now(), message: toRaw(message) } satisfies StoredMessage)
      stale.forEach(old => store.delete(old))
      return undefined
    })
  }

  function request(folder: string, id: string, images: boolean, peek: boolean): Promise<Entry> {
    const key = keyOf(folder, id, images)
    const running = inFlight.get(key)
    if (running) return running
    const promise = $fetch<MessageDetail>(`/api/messages/${encodeURIComponent(id)}`, {
      query: { folder, images: images ? 1 : undefined, peek: peek ? 1 : undefined }
    })
      .then((message) => {
        const entry = { message, marked: !peek }
        keep(key, entry)
        return entry
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }

  /** The copy on hand, if there is one */
  function cached(folder: string, id: string, images = false): Entry | undefined {
    return entries.get(keyOf(folder, id, images))
  }

  /**
   * Opens a message: the copy on hand, one already on its way, or the server.
   * A copy saved on this computer shows at once through `cached`, and the
   * server is still asked: it answers with the message as it is now, or, with
   * no connection, the saved copy stands and says it is one
   */
  async function open(folder: string, id: string, images = false): Promise<Entry> {
    const key = keyOf(folder, id, images)
    const hit = entries.get(key)
    if (hit && !hit.stored) {
      if (!images) save(key, hit.message)
      return hit
    }
    try {
      const entry = await request(folder, id, images, false)
      if (!images) save(key, entry.message)
      return entry
    } catch (error) {
      // Opened before the saved copies were read back (a window that starts on a message)
      await restoring
      // With images asked for, the saved copy without them is still the message
      const copy = entries.get(key) ?? (images ? entries.get(keyOf(folder, id, false)) : undefined)
      // Only when the mail couldn't be reached (no answer at all, or this app's server saying the mail
      // server didn't answer): "not found" or "sign in again" are answers, not a lost connection
      const answered = (error as { response?: { status?: number } }).response?.status
      const unreachable = answered === undefined || answered >= 500
      if (!copy?.stored || !unreachable) throw error
      return { ...copy, offline: true }
    }
  }

  /** The same without marking it read or saving it: for looking through messages that aren't being opened */
  function peek(folder: string, id: string): Promise<Entry> {
    const hit = cached(folder, id)
    return hit ? Promise.resolve(hit) : request(folder, id, false, true)
  }

  function drain() {
    while (ahead < AHEAD && queue.length) {
      const { folder, id } = queue.shift()!
      if (cached(folder, id) || inFlight.has(keyOf(folder, id, false))) continue
      ahead++
      request(folder, id, false, true).catch(() => {}).finally(() => {
        ahead--
        drain()
      })
    }
  }

  /** Fetches messages ahead without marking them read, newest wish first */
  function prefetch(items: { folder: string, id: string }[]) {
    for (const item of [...items].reverse()) {
      const index = queue.findIndex(entry => entry.folder === item.folder && entry.id === item.id)
      if (index !== -1) queue.splice(index, 1)
      queue.unshift(item)
    }
    queue.splice(12)
    drain()
  }

  // Another mailbox is another set of messages
  watch(() => account.value?.email, (email, before) => {
    entries.clear()
    queue.length = 0
    restoring = restore(!email && !!before)
  })
  restoring = restore()

  return { cached, open, peek, prefetch, warm }
}

export const useMessageCache = createAppComposable(_useMessageCache)

/**
 * Fetches a message ahead when the pointer rests on its row for a moment:
 * by the time it's clicked, it's here. Rows carry their id in data-id
 */
export function usePrefetchOnHover(target: Ref<HTMLElement | undefined>) {
  const { messages } = useMail()
  const { prefetch } = useMessageCache()
  let timer: ReturnType<typeof setTimeout> | undefined
  useEventListener(target, 'pointerover', (event: PointerEvent) => {
    const id = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-id]')?.dataset.id
    clearTimeout(timer)
    if (!id) return
    timer = setTimeout(() => {
      const message = messages.value.find(row => row.id === id)
      if (message) prefetch([{ folder: message.folder, id }])
    }, 80)
  })
}
