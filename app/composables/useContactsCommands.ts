import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

/**
 * The contacts page's part of the palette: its own actions. The people
 * themselves are in the palette everywhere. Called by the page, so it is
 * only there with it
 */
export function useContactsCommands() {
  const { openCreate, duplicatesOpen } = useContactsPage()

  useCommands((): CommandPaletteGroup<CommandPaletteItem>[] => [{
    id: 'contacts-actions',
    label: 'Contacts',
    items: [{
      label: 'New contact',
      icon: 'i-lucide-user-plus',
      onSelect: () => openCreate()
    }, {
      label: 'Find duplicates',
      icon: 'i-lucide-copy-check',
      onSelect: () => (duplicatesOpen.value = true)
    }]
  }])
}
