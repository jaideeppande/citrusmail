export interface SavedSearch {
  id: string
  name: string
  folder: string
  search: string
  filter: 'all' | 'unread' | 'flagged'
  filters: MailFilters
}

// Searches kept in the sidebar like folders: a folder, the words, and the
// filters, under a name. Kept on this computer, per mailbox
export function useSavedSearches() {
  const mail = useMail()
  const saved = useAccountPref<SavedSearch[]>('saved-searches', () => [])

  /** There is something on screen worth saving: words or filters, not AI results */
  const canSave = computed(() => !mail.ai.value.on && (!!mail.search.value.trim() || mail.filtering.value || mail.filter.value !== 'all'))

  const same = (item: SavedSearch) => item.folder === mail.folderPath.value
    && item.search === mail.search.value.trim()
    && item.filter === mail.filter.value
    && JSON.stringify(item.filters) === JSON.stringify(mail.filters.value)
  const current = computed(() => saved.value.find(same))

  function save(name: string) {
    const label = name.trim().slice(0, 60)
    if (!label || !canSave.value) return
    saved.value = [...saved.value.filter(item => item.name.toLowerCase() !== label.toLowerCase()), {
      id: Math.random().toString(36).slice(2, 10),
      name: label,
      folder: mail.folderPath.value,
      search: mail.search.value.trim(),
      filter: mail.filter.value,
      filters: { ...mail.filters.value }
    }]
  }

  function remove(id: string) {
    saved.value = saved.value.filter(item => item.id !== id)
  }

  async function apply(item: SavedSearch) {
    if (mail.ai.value.on) mail.exitAi()
    if (mail.folderPath.value !== item.folder || !useRoute().path.startsWith('/mail/')) await navigateTo(folderLink(item.folder))
    mail.search.value = item.search
    mail.filter.value = item.filter
    mail.filters.value = { ...item.filters }
  }

  /** What a saved search looks for, in a few words, when it has no better name */
  function describe(item: Pick<SavedSearch, 'search' | 'filter' | 'filters'>) {
    const parts: string[] = []
    if (item.search) parts.push(item.search)
    if (item.filters.from) parts.push(`from ${item.filters.from}`)
    if (item.filter !== 'all') parts.push(item.filter)
    if (item.filters.attachments) parts.push('with files')
    if (item.filters.within) parts.push(`this ${item.filters.within}`)
    if (item.filters.on) parts.push(item.filters.on)
    return parts.join(', ')
  }

  return { saved, canSave, current, save, remove, apply, describe }
}
