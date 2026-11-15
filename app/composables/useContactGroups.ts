import type { ContactGroup } from './useContactExtras'

/** What a contacts row carries when dragged onto a group: the people, as JSON `Address[]` */
export const CONTACT_DRAG_TYPE = 'application/x-citrusmail-contacts'

export interface GroupSuggestion {
  group: ContactGroup
  /** “Team (5 people)” */
  label: string
  members: Address[]
}

const keyOf = (address: string) => address.trim().toLowerCase()

/** A contact as group members: one entry for their first address, the one mail goes to */
export function contactMember(contact: Contact): Address | undefined {
  const address = contact.emails[0]?.trim()
  return address ? { name: contact.name, address } : undefined
}

export function peopleCount(count: number): string {
  return count === 1 ? '1 person' : `${count} people`
}

/**
 * Groups and distribution lists, on top of what `useContactExtras` keeps on
 * this computer. Members are names and addresses rather than contact ids, so
 * a group still reaches someone whose contact was deleted, and can hold
 * people who were never in the address book
 */
export function useContactGroups() {
  const { groups, saveGroup, removeGroup } = useContactExtras()
  const toast = useToast()

  const byId = (id: string | undefined) => id ? groups.value.find(group => group.id === id) : undefined

  function isMember(group: ContactGroup, contact: Contact): boolean {
    const keys = new Set(group.members.map(member => keyOf(member.address)))
    return contact.emails.some(email => keys.has(keyOf(email)))
  }

  const groupsOf = (contact: Contact) => groups.value.filter(group => isMember(group, contact))

  function create(name: string, members: Address[] = []) {
    const group = saveGroup({ name, members: dedupe(members) })
    announce(members.length ? `Group ${group.name} created with ${peopleCount(group.members.length)}` : `Group ${group.name} created`)
    return group
  }

  function rename(group: ContactGroup, name: string) {
    const saved = saveGroup({ ...group, name })
    announce(`Renamed to ${saved.name}`)
    return saved
  }

  /** Adds the people who are not in it yet; says how many that was */
  function add(group: ContactGroup, people: Address[]): number {
    const present = new Set(group.members.map(member => keyOf(member.address)))
    const fresh = dedupe(people).filter(person => !present.has(keyOf(person.address)))
    if (fresh.length) saveGroup({ ...group, members: [...group.members, ...fresh] })

    const text = fresh.length
      ? `Added ${fresh.length === 1 ? fresh[0]!.name || fresh[0]!.address : peopleCount(fresh.length)} to ${group.name}`
      : `Already in ${group.name}`
    toast.add({ title: text, icon: fresh.length ? 'i-lucide-users' : 'i-lucide-info' })
    announce(text)
    return fresh.length
  }

  function addContacts(group: ContactGroup, contacts: Contact[]) {
    const people = contacts.map(contactMember).filter((member): member is Address => !!member)
    const missing = contacts.length - people.length
    if (!people.length) {
      toast.add({ title: 'Nobody to add', description: 'A group needs an email address for each person.', icon: 'i-lucide-info' })
      announce('Nobody to add: a group needs an email address for each person')
      return 0
    }
    const added = add(group, people)
    if (missing) toast.add({ title: missing === 1 ? '1 contact has no email address' : `${missing} contacts have no email address`, description: 'They were left out of the group.', icon: 'i-lucide-info' })
    return added
  }

  /** Takes people out: every address of a contact, or the one address given */
  function removeMembers(group: ContactGroup, people: (Address | Contact)[]) {
    const keys = new Set(people.flatMap(person => 'emails' in person ? person.emails.map(keyOf) : [keyOf(person.address)]))
    saveGroup({ ...group, members: group.members.filter(item => !keys.has(keyOf(item.address))) })
    const only = people.length === 1 ? people[0]! : undefined
    const name = only ? only.name || ('address' in only ? only.address : '') : peopleCount(people.length)
    announce(`Removed ${name} from ${group.name}`)
  }

  function remove(group: ContactGroup) {
    removeGroup(group.id)
    // Nothing on a server is lost, but a list of thirty people is work to rebuild
    toast.add({
      title: `Deleted ${group.name}`,
      icon: 'i-lucide-trash-2',
      actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => void saveGroup(group) }]
    })
    announce(`Group ${group.name} deleted`)
  }

  function write(group: ContactGroup) {
    if (group.members.length) useComposer().compose(group.members)
  }

  /**
   * Groups whose name starts with, or has a word starting with, what was
   * typed: for a recipient field to offer the whole list at once
   */
  function groupSuggestions(query: string): GroupSuggestion[] {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return groups.value
      .filter(group => group.members.length && group.name.toLowerCase().split(/[\s\-_/]+/).concat(group.name.toLowerCase()).some(word => word.startsWith(term)))
      .map(group => ({ group, label: `${group.name} (${peopleCount(group.members.length)})`, members: group.members }))
  }

  return { groups, byId, isMember, groupsOf, create, rename, add, addContacts, removeMembers, remove, write, groupSuggestions }
}

function dedupe(people: Address[]): Address[] {
  const seen = new Set<string>()
  return people.filter((person) => {
    const key = keyOf(person.address)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
