export type DuplicateState = 'idle' | 'merging' | 'done' | 'failed' | 'skipped'

/**
 * The duplicates dialog: the groups as they stood when it was opened, and
 * what has become of each since. A snapshot rather than a live list, so a
 * group stays where it is on screen while it is merged out of the address book
 */
export function useContactDuplicates() {
  const { contacts, save, remove } = useContacts()
  const { selectedId } = useContactsPage()
  const { transfer } = useContactFavourites()
  const toast = useToast()

  const groups = shallowRef<DuplicateGroup[]>([])
  const states = ref<Record<string, DuplicateState>>({})
  // How far a run of merges has got, counted in groups
  const progress = ref<{ done: number, total: number } | null>(null)

  function scan() {
    groups.value = findDuplicateGroups(contacts.value)
    states.value = {}
    progress.value = null
  }

  const stateOf = (group: DuplicateGroup): DuplicateState => states.value[group.key] ?? 'idle'
  const pending = computed(() => groups.value.filter(group => ['idle', 'failed'].includes(stateOf(group))))
  const busy = computed(() => !!progress.value)

  function skip(group: DuplicateGroup) {
    states.value = { ...states.value, [group.key]: 'skipped' }
    announce('Skipped')
  }

  function restore(group: DuplicateGroup) {
    states.value = { ...states.value, [group.key]: 'idle' }
    announce('Brought back')
  }

  // The kept contact is written first, and nothing is deleted unless that
  // landed: a failed merge leaves every copy where it was
  async function mergeOne(group: DuplicateGroup): Promise<boolean> {
    states.value = { ...states.value, [group.key]: 'merging' }

    const saved = await save(group.merged, { quiet: true })
    if (!saved) {
      states.value = { ...states.value, [group.key]: 'failed' }
      return false
    }

    const others = group.contacts.slice(1)
    const removed = await Promise.all(others.map(contact => remove(contact, { quiet: true })))
    const gone = others.filter((_, index) => removed[index])

    transfer(gone.map(contact => contact.id), saved.id)
    if (selectedId.value && gone.some(contact => contact.id === selectedId.value)) selectedId.value = saved.id

    states.value = { ...states.value, [group.key]: removed.every(Boolean) ? 'done' : 'failed' }

    return removed.every(Boolean)
  }

  async function merge(targets: DuplicateGroup[]) {
    if (busy.value || !targets.length) return

    progress.value = { done: 0, total: targets.length }
    let merged = 0

    for (const group of targets) {
      if (await mergeOne(group)) merged++
      progress.value = { done: progress.value.done + 1, total: targets.length }
    }

    progress.value = null
    tellWindows({ type: 'contacts:changed' })

    const failed = targets.length - merged
    announce(merged ? `Merged ${merged === 1 ? '1 contact' : `${merged} contacts`}${failed ? `, ${failed} couldn’t be merged` : ''}` : 'Couldn’t merge the contacts', !merged)
    if (merged) {
      toast.add({
        title: merged === 1 ? 'Merged 1 contact' : `Merged ${merged} contacts`,
        description: failed ? `${failed} couldn’t be merged and were left as they were.` : undefined,
        icon: 'i-lucide-check'
      })
    } else {
      toast.add({ title: 'Couldn’t merge the contacts', description: 'Nothing was changed.', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  return { groups, pending, progress, busy, stateOf, scan, skip, restore, merge }
}
