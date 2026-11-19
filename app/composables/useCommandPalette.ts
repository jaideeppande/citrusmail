import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

type Group = CommandPaletteGroup<CommandPaletteItem>

// The app's one palette (Ctrl/Cmd+K): go anywhere, do anything, find anyone.
// Features add their own commands with `useCommands`, so the palette never
// has to know about them
const _useCommandPalette = () => {
  const isOpen = ref(false)
  const sources = shallowRef<(() => Group[])[]>([])

  function register(source: () => Group[]) {
    sources.value = [...sources.value, source]
    return () => (sources.value = sources.value.filter(item => item !== source))
  }

  const groups = computed(() => sources.value.flatMap(source => source()).filter(group => group.items?.length))

  defineAppShortcuts({
    // Enabled while typing so it also closes the palette from its own input
    'app.palette': { usingInput: true, handler: () => (isOpen.value = !isOpen.value) }
  })

  return { isOpen, groups, register, open: () => (isOpen.value = true) }
}

export const useCommandPalette = createAppComposable(_useCommandPalette)

/** Adds commands to the palette for as long as the caller lives */
export function useCommands(source: () => Group[]) {
  const stop = useCommandPalette().register(source)
  if (getCurrentScope()) onScopeDispose(stop)
}
