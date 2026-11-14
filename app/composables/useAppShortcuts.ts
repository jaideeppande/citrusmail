import type { ShortcutId, ShortcutPreset } from '~/utils/shortcuts'

type Handler = (() => void) | { handler: () => void, usingInput?: boolean | string }

interface KeyPrefs {
  preset: ShortcutPreset
  /** Your own keys, which win over the preset */
  custom: Partial<Record<ShortcutId, string[]>>
}

/** Which keys run each shortcut right now: your own, then the preset, then the default */
export function useShortcutKeys() {
  const prefs = useLocalPref<KeyPrefs>('keys', { preset: 'citrusmail', custom: {} })

  function keysOf(id: ShortcutId): string[] {
    return prefs.value.custom[id] ?? SHORTCUT_PRESETS[prefs.value.preset]?.keys[id] ?? [...SHORTCUTS[id].keys]
  }

  /** The first key, split for <UKbd> or a tooltip's `kbds` */
  function kbds(id: ShortcutId): string[] {
    const first = keysOf(id)[0]
    return first ? shortcutParts(first) : []
  }

  /** Another shortcut already on this key, if any */
  function clash(id: ShortcutId, key: string): ShortcutId | undefined {
    const group = SHORTCUTS[id].group
    return (Object.keys(SHORTCUTS) as ShortcutId[]).find(other => other !== id
      // Mail and calendar keys never meet: each only acts on its own page
      && !(group === 'Calendar' && SHORTCUTS[other].group === 'Mail')
      && !(group === 'Mail' && SHORTCUTS[other].group === 'Calendar')
      && keysOf(other).includes(key))
  }

  function rebind(id: ShortcutId, keys: string[] | undefined) {
    const custom = Object.fromEntries(Object.entries(prefs.value.custom).filter(([key]) => key !== id))
    prefs.value = { ...prefs.value, custom: keys ? { ...custom, [id]: keys } : custom }
  }

  return { prefs, keysOf, kbds, clash, rebind }
}

/**
 * `defineShortcuts`, by name instead of by key, so every shortcut follows
 * Settings → Shortcuts. Pass a getter to switch a set on and off
 */
export function defineAppShortcuts(config: MaybeRefOrGetter<Partial<Record<ShortcutId, Handler>>>) {
  const { keysOf } = useShortcutKeys()
  defineShortcuts(computed(() => {
    const keys: Record<string, Handler> = {}
    for (const [id, handler] of Object.entries(toValue(config)) as [ShortcutId, Handler][]) {
      for (const key of keysOf(id)) keys[key] = handler
    }
    return keys
  }))
}
