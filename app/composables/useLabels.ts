import type { LabelColor, MailLabel } from '~/utils/labels'

// The labels you've made and which messages carry them. Kept on this
// computer, per mailbox, shared by every window
const _useLabels = () => {
  const labels = useAccountPref<MailLabel[]>('labels', () => [])
  /** Message → the ids of its labels */
  const tagged = useAccountPref<Record<string, string[]>>('labelled', () => ({}))

  const byId = computed(() => new Map(labels.value.map(label => [label.id, label])))

  /** A message's labels, in the order the labels are listed */
  function labelsOf(message: MessageSummary): MailLabel[] {
    const ids = tagged.value[labelKey(message)]
    if (!ids?.length) return []
    return labels.value.filter(label => ids.includes(label.id))
  }

  const has = (message: MessageSummary, id: string) => !!tagged.value[labelKey(message)]?.includes(id)

  /** Puts a label on every message, or takes it off when all of them already have it */
  function toggle(messages: MessageSummary[], id: string) {
    const label = byId.value.get(id)
    if (!label || !messages.length) return
    const on = !messages.every(message => has(message, id))
    const next = { ...tagged.value }
    for (const message of messages) {
      const key = labelKey(message)
      const ids = (next[key] ?? []).filter(item => item !== id)
      if (on) ids.push(id)
      if (ids.length) next[key] = ids
      else Reflect.deleteProperty(next, key)
    }
    tagged.value = next
    const count = messages.length === 1 ? '' : ` on ${messages.length} conversations`
    announce(on ? `Labelled ${label.name}${count}` : `Removed ${label.name}${count}`)
  }

  function create(name: string, color?: LabelColor): MailLabel | undefined {
    const label = name.trim().slice(0, 40)
    if (!label) return undefined
    const existing = labels.value.find(item => item.name.toLowerCase() === label.toLowerCase())
    if (existing) return existing
    // The next colour not in use yet, so new labels can be told apart without choosing
    const free = LABEL_COLORS.find(item => !labels.value.some(other => other.color === item))
    const made: MailLabel = { id: Math.random().toString(36).slice(2, 10), name: label, color: color ?? free ?? LABEL_COLORS[labels.value.length % LABEL_COLORS.length]! }
    labels.value = [...labels.value, made]
    return made
  }

  function update(id: string, change: Partial<Pick<MailLabel, 'name' | 'color'>>) {
    labels.value = labels.value.map(label => label.id === id ? { ...label, ...change, name: (change.name ?? label.name).trim().slice(0, 40) || label.name } : label)
  }

  function remove(id: string) {
    labels.value = labels.value.filter(label => label.id !== id)
    const next: Record<string, string[]> = {}
    for (const [key, ids] of Object.entries(tagged.value)) {
      const kept = ids.filter(item => item !== id)
      if (kept.length) next[key] = kept
    }
    tagged.value = next
  }

  /** How many messages carry each label */
  const counts = computed(() => {
    const result = new Map<string, number>()
    for (const ids of Object.values(tagged.value)) for (const id of ids) result.set(id, (result.get(id) ?? 0) + 1)
    return result
  })

  return { labels, labelsOf, has, toggle, create, update, remove, counts }
}

export const useLabels = createAppComposable(_useLabels)

// The label picker: one dialog for the whole app, opened with the messages it's for
const _useLabelPicker = () => {
  const isOpen = ref(false)
  const messages = shallowRef<MessageSummary[]>([])

  function pick(list: MessageSummary[]) {
    if (!list.length) return
    messages.value = list
    isOpen.value = true
  }

  return { isOpen, messages, pick }
}

export const useLabelPicker = createAppComposable(_useLabelPicker)
