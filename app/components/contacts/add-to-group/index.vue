<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// “Add to group…”: every group, and a new one, for one person or several.
// The keyboard’s way of doing what dragging a row onto a group does
const props = defineProps<{
  contacts: Contact[]
}>()

const { groups, addContacts, isMember } = useContactGroups()
const { openGroupDialog } = useContactsPage()

const items = computed<DropdownMenuItem[][]>(() => {
  const single = props.contacts.length === 1 ? props.contacts[0] : undefined
  return [
    groups.value.map(group => ({
      label: group.name,
      icon: 'i-lucide-users',
      // One person already in it: shown ticked, and picking it again says so
      ...(single && isMember(group, single) ? { trailingIcon: 'i-lucide-check' } : {}),
      onSelect: () => void addContacts(group, props.contacts)
    })),
    [{
      label: 'New group…',
      icon: 'i-lucide-plus',
      onSelect: () => openGroupDialog(undefined, props.contacts.map(contactMember).filter((member): member is Address => !!member))
    }]
  ].filter(section => section.length)
})
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start' }"
  >
    <slot />
  </UDropdownMenu>
</template>
