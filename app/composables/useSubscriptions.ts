// Everyone sending you list mail, with a way out of each
export function useSubscriptions() {
  const { data: subscriptions, status, refresh } = useFetch<Subscription[]>('/api/subscriptions', { key: 'subscriptions', server: false, default: () => [] })
  const { unsubscribe } = useUnsubscribe()
  const { block } = useSenders()
  const busy = ref(new Set<string>())
  const query = ref('')

  const shown = computed(() => {
    const q = query.value.trim().toLowerCase()
    return q ? subscriptions.value.filter(item => item.address.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q)) : subscriptions.value
  })

  async function leave(item: Subscription) {
    busy.value = new Set(busy.value).add(item.address)
    const done = await unsubscribe({ folder: item.folder, id: item.id }, item.name || item.address)
    if (done) subscriptions.value = subscriptions.value.map(entry => entry.address === item.address ? { ...entry, unsubscribedAt: new Date().toISOString() } : entry)
    const next = new Set(busy.value)
    next.delete(item.address)
    busy.value = next
  }

  // Leaving several lists in one go: ticked here, then left one after another
  // (not all at once, which a mail server would take for abuse)
  const picked = ref(new Set<string>())
  const pickable = (item: Subscription) => !item.unsubscribedAt
  function pick(item: Subscription) {
    const next = new Set(picked.value)
    if (!next.delete(item.address)) next.add(item.address)
    picked.value = next
  }
  function pickAll() {
    const open = shown.value.filter(pickable)
    picked.value = picked.value.size === open.length ? new Set() : new Set(open.map(item => item.address))
  }
  const sweep = ref<{ done: number, total: number }>()
  async function leaveMany() {
    const items = subscriptions.value.filter(item => picked.value.has(item.address) && pickable(item))
    sweep.value = { done: 0, total: items.length }
    for (const item of items) {
      await leave(item)
      sweep.value = { done: sweep.value.done + 1, total: items.length }
    }
    picked.value = new Set()
    // The finished bar stays a moment, long enough to be seen
    setTimeout(() => (sweep.value = undefined), 900)
  }

  return { subscriptions, shown, query, status, refresh, busy, leave, block, picked, pick, pickAll, pickable, leaveMany, sweep }
}
