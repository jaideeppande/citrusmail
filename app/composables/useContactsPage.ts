import type { ContactGroup } from './useContactExtras'

/** What the editor keeps on this computer alongside the contact: `null` clears it, `undefined` leaves it */
export interface ContactLocalExtras {
  photo?: string | null
  zone?: string | null
}

export type ExportScope = 'all' | 'group' | 'selection'

// The contacts page: search, the address book or group shown, the selected
// contact, the ticked ones, and the dialogs the page opens
const _useContactsPage = () => {
  const route = useRoute()
  const router = useRouter()
  const { contacts, books, status, save, remove } = useContacts()
  const { setPhoto, setTimeZone, photoOf, timeZoneOf } = useContactExtras()
  const contactGroups = useContactGroups()
  const overlay = useOverlay()

  const search = ref('')
  const book = computed(() => route.query.book as string | undefined)
  const groupId = computed(() => route.query.group as string | undefined)
  const group = computed(() => contactGroups.byId(groupId.value))

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    const inGroup = group.value
    return contacts.value.filter(contact =>
      (!book.value || contact.bookId === book.value)
      && (!inGroup || contactGroups.isMember(inGroup, contact))
      && (!term || [contact.name, contact.company, ...contact.emails, ...contact.phones].some(value => value?.toLowerCase().includes(term))))
  })

  const { ids: favouriteIds } = useContactFavourites()

  // Grouped under their first letter, the way an address book reads, with
  // the starred ones gathered once more at the top
  const sections = computed(() => {
    const favourites = filtered.value.filter(contact => favouriteIds.value.includes(contact.id))
    const map = new Map<string, Contact[]>()
    for (const contact of filtered.value) {
      map.set(initialOf(contact.name), [...(map.get(initialOf(contact.name)) ?? []), contact])
    }
    return [
      ...(favourites.length ? [{ key: 'favourites', label: 'Favourites', items: favourites }] : []),
      ...[...map.entries()].map(([letter, items]) => ({ key: letter, label: letter, items }))
    ]
  })

  const selectedId = computed<string | undefined>({
    get: () => route.query.c as string | undefined,
    set: id => router.replace({ query: { ...route.query, c: id || undefined } })
  })
  const selected = computed(() => contacts.value.find(contact => contact.id === selectedId.value))

  // Ticked rows, for adding several people to a group or exporting them at once
  const checkedIds = ref<string[]>([])
  const checked = computed(() => contacts.value.filter(contact => checkedIds.value.includes(contact.id)))
  const isChecked = (contact: Contact) => checkedIds.value.includes(contact.id)
  function toggleCheck(contact: Contact) {
    checkedIds.value = isChecked(contact) ? checkedIds.value.filter(id => id !== contact.id) : [...checkedIds.value, contact.id]
    announce(checkedIds.value.length ? `${checkedIds.value.length} selected` : 'Selection cleared')
  }
  function checkAll() {
    checkedIds.value = filtered.value.map(contact => contact.id)
    announce(`${checkedIds.value.length} selected`)
  }
  function clearChecks() {
    if (!checkedIds.value.length) return
    checkedIds.value = []
    announce('Selection cleared')
  }
  // Someone deleted elsewhere is no longer ticked
  watch(contacts, (list) => {
    const ids = new Set(list.map(contact => contact.id))
    if (checkedIds.value.some(id => !ids.has(id))) checkedIds.value = checkedIds.value.filter(id => ids.has(id))
  })

  const editorOpen = ref(false)
  const editing = ref<Contact | null>(null)

  function openCreate(fields: Partial<Contact> = {}) {
    editing.value = { id: '', bookId: book.value ?? books.value[0]?.id ?? '', name: '', emails: [''], phones: [], ...fields }
    editorOpen.value = true
  }

  function openEdit(contact: Contact) {
    editing.value = { ...contact, emails: contact.emails.length ? [...contact.emails] : [''], phones: [...contact.phones] }
    editorOpen.value = true
  }

  // A photo and a time zone belong to the addresses, so they follow the
  // contact when an address is added and leave the ones taken off it
  function moveExtras(before: string[], after: string[], extras: ContactLocalExtras) {
    const photo = extras.photo !== undefined ? extras.photo ?? undefined : photoOf(before[0]) ?? photoOf(after[0])
    const zone = extras.zone !== undefined ? extras.zone ?? undefined : timeZoneOf(before[0]) ?? timeZoneOf(after[0])
    const kept = new Set(after.map(address => address.toLowerCase()))
    const gone = before.filter(address => !kept.has(address.toLowerCase()))
    if (gone.length) {
      setPhoto(gone, undefined)
      setTimeZone(gone, undefined)
    }
    if (after.length) {
      setPhoto(after, photo)
      setTimeZone(after, zone)
    }
  }

  // Held until the server answers, so a second click on a slow server can't add the contact twice
  const saving = ref(false)
  async function submit(contact: Contact, extras: ContactLocalExtras = {}) {
    if (saving.value) return
    saving.value = true
    const before = contacts.value.find(item => item.id === contact.id)?.emails ?? []
    const saved = await save({ ...contact, emails: contact.emails.map(email => email.trim()).filter(Boolean), phones: contact.phones.map(phone => phone.trim()).filter(Boolean) })
    saving.value = false
    if (saved) {
      moveExtras(before, saved.emails, extras)
      editorOpen.value = false
      selectedId.value = saved.id
      announce(contact.id ? 'Contact saved' : `${saved.name} added`)
    }
  }

  async function confirmRemove(contact: Contact) {
    const ConfirmDialog = (await import('~/components/confirm-dialog/index.vue')).default
    const modal = overlay.create(ConfirmDialog, {
      props: { title: `Delete ${contact.name}?`, message: 'The contact is removed from your address book on every device.', confirmLabel: 'Delete contact' }
    })
    if (await modal.open().result) {
      selectedId.value = undefined
      if (await remove(contact)) announce(`${contact.name} deleted`)
    }
  }

  const duplicatesOpen = ref(false)
  const importOpen = ref(false)

  const exportOpen = ref(false)
  const exportScope = ref<ExportScope>('all')
  function openExport(scope?: ExportScope) {
    exportScope.value = scope ?? (checkedIds.value.length ? 'selection' : group.value ? 'group' : 'all')
    exportOpen.value = true
  }

  // The name dialog, for a new group or renaming one. `members` go into a new group straight away
  const groupDialog = ref<{ open: boolean, group?: ContactGroup, members: Address[] }>({ open: false, members: [] })
  function openGroupDialog(group?: ContactGroup, members: Address[] = []) {
    groupDialog.value = { open: true, group, members }
  }

  async function confirmRemoveGroup(target: ContactGroup) {
    const ConfirmDialog = (await import('~/components/confirm-dialog/index.vue')).default
    const modal = overlay.create(ConfirmDialog, {
      props: { title: `Delete ${target.name}?`, message: 'The group goes. Everyone in it stays in your address book.', confirmLabel: 'Delete group' }
    })
    if (!await modal.open().result) return
    if (groupId.value === target.id) await router.replace({ query: { ...route.query, group: undefined } })
    contactGroups.remove(target)
  }

  return {
    contacts,
    books,
    status,
    search,
    book,
    groupId,
    group,
    sections,
    filtered,
    selectedId,
    selected,
    checkedIds,
    checked,
    isChecked,
    toggleCheck,
    checkAll,
    clearChecks,
    editorOpen,
    editing,
    saving,
    duplicatesOpen,
    importOpen,
    exportOpen,
    exportScope,
    groupDialog,
    openCreate,
    openEdit,
    openExport,
    openGroupDialog,
    confirmRemoveGroup,
    submit,
    confirmRemove
  }
}

/** The letter a name is filed under: Émile among the E’s, any script’s letters, `#` for the rest */
export function initialOf(name: string): string {
  const base = name.normalize('NFD').replace(/\p{M}/gu, '')
  return /^\p{L}/u.test(base) ? base[0]!.toLocaleUpperCase() : '#'
}

export const useContactsPage = createAppComposable(_useContactsPage)
