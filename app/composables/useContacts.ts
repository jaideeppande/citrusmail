// Contacts from the CardDAV server, fetched once and shared by the contacts
// page and the composer's recipient suggestions
const _useContacts = () => {
  const toast = useToast()
  const { account } = useShell()

  const { data: contacts, status, refresh } = useFetch<Contact[]>('/api/contacts', {
    key: 'contacts',
    default: () => [],
    server: false,
    immediate: !!account.value?.hasContacts
  })

  const { data: books } = useFetch<ContactBook[]>('/api/books', {
    key: 'books',
    default: () => [],
    server: false,
    immediate: !!account.value?.hasContacts
  })

  // Another window added, changed or removed someone
  onWindowEvent((event) => {
    if (event.type === 'contacts:changed' && account.value?.hasContacts) refresh()
  })

  // `quiet` is for a caller that reports on a whole batch itself (merging
  // duplicates, an import): no toast per contact, and it tells the other
  // windows once. `onError` hears the server's reason when it refuses
  async function save(contact: Contact, { quiet = false, onError }: { quiet?: boolean, onError?: (reason: string) => void } = {}) {
    try {
      const saved = contact.id
        ? await $fetch<Contact>(`/api/contacts/${contact.id}`, { method: 'PUT', body: contact })
        : await $fetch<Contact>('/api/contacts', { method: 'POST', body: contact })
      contacts.value = [...contacts.value.filter(item => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      if (!quiet) {
        toast.add({ title: contact.id ? 'Contact saved' : 'Contact added', icon: 'i-lucide-check' })
        tellWindows({ type: 'contacts:changed' })
      }
      return saved
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      onError?.(message || 'The address book didn’t answer')
      if (!quiet) toast.add({ title: 'Couldn’t save the contact', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function remove(contact: Contact, { quiet = false } = {}) {
    contacts.value = contacts.value.filter(item => item.id !== contact.id)
    try {
      await $fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
      if (!quiet) {
        toast.add({ title: 'Contact deleted', icon: 'i-lucide-trash-2' })
        tellWindows({ type: 'contacts:changed' })
      }
      return true
    } catch {
      // Put back among whoever is there now, which a batch may have changed since
      if (!contacts.value.some(item => item.id === contact.id)) {
        contacts.value = [...contacts.value, contact].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      }
      if (!quiet) toast.add({ title: 'Couldn’t delete the contact', color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  // The people you write to most, a keystroke away from anywhere in the app
  const favouriteIds = useAccountPref<string[]>('contact-favourites', () => [])

  useCommands(() => [{
    id: 'favourite-contacts',
    label: 'Favourite contacts',
    items: contacts.value
      .filter(contact => favouriteIds.value.includes(contact.id) && contact.emails[0])
      .map(contact => ({
        label: contact.name,
        suffix: contact.emails[0],
        icon: 'i-ph-star-fill',
        onSelect: () => useComposer().compose([{ name: contact.name, address: contact.emails[0]! }])
      }))
  }])

  // Each group is one command away too, as a whole list of recipients
  const { groups } = useContactExtras()
  useCommands(() => [{
    id: 'contact-groups',
    label: 'Groups',
    items: groups.value
      .filter(group => group.members.length)
      .map(group => ({
        label: `Write to ${group.name}`,
        suffix: peopleCount(group.members.length),
        icon: 'i-lucide-users',
        onSelect: () => useComposer().compose(group.members)
      }))
  }])

  return { contacts, books, status, refresh, save, remove }
}

export const useContacts = createAppComposable(_useContacts)
