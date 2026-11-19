import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

/**
 * The contacts page's part of the palette: its own actions. The people
 * and the groups themselves are in the palette everywhere. Called by the
 * page, so it is only there with it
 */
export function useContactsCommands() {
  const { openCreate, duplicatesOpen, importOpen, openExport, openGroupDialog, checked, contacts } = useContactsPage()

  useCommands((): CommandPaletteGroup<CommandPaletteItem>[] => [{
    id: 'contacts-actions',
    label: 'Contacts',
    items: [{
      label: 'New contact',
      icon: 'i-lucide-user-plus',
      onSelect: () => openCreate()
    }, {
      label: 'New group',
      icon: 'i-lucide-users',
      onSelect: () => openGroupDialog(undefined, checked.value.map(contactMember).filter((member): member is Address => !!member))
    }, {
      label: 'Import contacts…',
      icon: 'i-lucide-upload',
      onSelect: () => (importOpen.value = true)
    }, ...(contacts.value.length
      ? [{
          label: 'Export contacts…',
          icon: 'i-lucide-download',
          onSelect: () => openExport()
        }, {
          label: 'Find duplicates',
          icon: 'i-lucide-copy-check',
          onSelect: () => (duplicatesOpen.value = true)
        }]
      : []), {
      label: 'Relationships',
      icon: 'i-lucide-chart-no-axes-column',
      onSelect: () => navigateTo('/contacts/relationships')
    }]
  }])
}
