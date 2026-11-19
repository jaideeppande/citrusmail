export interface ContactGroup {
  id: string
  name: string
  members: Address[]
}

// What CitrusMail knows about people that an address book has no field for:
// the groups you put them in, a photo you chose, the time zone they live in.
// Kept on this computer, per mailbox, keyed by email address so it applies
// wherever that person shows up (mail, the composer, contacts)
export function useContactExtras() {
  const groups = useAccountPref<ContactGroup[]>('contact-groups', () => [])
  const photos = useAccountPref<Record<string, string>>('contact-photos', () => ({}))
  const zones = useAccountPref<Record<string, string>>('contact-zones', () => ({}))

  const key = (address: string) => address.trim().toLowerCase()

  /** A small square picture as a data URL, if one was set for this address */
  const photoOf = (address?: string) => address ? photos.value[key(address)] : undefined
  function setPhoto(addresses: string[], photo: string | undefined) {
    const next = { ...photos.value }
    for (const address of addresses) {
      if (photo) next[key(address)] = photo
      else Reflect.deleteProperty(next, key(address))
    }
    photos.value = next
  }

  /** An IANA zone such as Europe/Berlin, if one was set for this address */
  const timeZoneOf = (address?: string) => address ? zones.value[key(address)] : undefined
  function setTimeZone(addresses: string[], zone: string | undefined) {
    const next = { ...zones.value }
    for (const address of addresses) {
      if (zone) next[key(address)] = zone
      else Reflect.deleteProperty(next, key(address))
    }
    zones.value = next
  }

  function saveGroup(group: Omit<ContactGroup, 'id'> & { id?: string }) {
    const id = group.id ?? Math.random().toString(36).slice(2, 10)
    const next = { id, name: group.name.trim().slice(0, 60), members: group.members }
    groups.value = [...groups.value.filter(item => item.id !== id), next].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return next
  }
  function removeGroup(id: string) {
    groups.value = groups.value.filter(item => item.id !== id)
  }

  return { groups, saveGroup, removeGroup, photoOf, setPhoto, timeZoneOf, setTimeZone }
}
