import type { Appearance, ThemeOverride } from '~/utils/theme'
import type { SurfaceKey, ThemeKey, ThemeMode, ThemeSection } from '~/utils/theme-editor'

// The person's own theme, in two places: the accent, font, text size and
// corners are saved with the account (and follow them to other devices);
// greys, surface colors and the sheet stay on this computer, because the
// server only keeps those four. The theme plugin layers the second over the
// first. Both the Appearance tab and the theme editor change it through here
const _useThemeEditor = () => {
  const { $appearance } = useNuxtApp()
  const { settings, save } = useSettings()
  const custom = useLocalPref<ThemeOverride>('theme-custom', {})
  const saved = useLocalPref<SavedTheme[]>('theme-saved', [])

  /** Everything the person has changed, as one override: what "Copy as JSON" gives */
  const current = computed<ThemeOverride>(() => normalTheme({ ...cleanThemeOverride($appearance.value), ...custom.value }))

  // Changes show at once and are saved a moment later. The background
  // picture lives in `appearance` too and is left as it is
  const persist = useDebounceFn(() => save({ appearance: { ...$appearance.value, background: settings.value.appearance?.background } }, false), 800)

  function setSynced(patch: Appearance) {
    const next = { ...$appearance.value, ...patch }
    $appearance.value = Object.fromEntries(Object.entries(next).filter(([key, value]) => value || !(SYNCED_KEYS as string[]).includes(key)))
    persist()
  }

  function setLocal(next: ThemeOverride) {
    custom.value = normalTheme(next)
  }

  /** One value; empty puts the instance's own back */
  function set(key: ThemeKey, value: string | undefined) {
    if ((SYNCED_KEYS as string[]).includes(key) && (!value || SYNCED_SHAPES[key as keyof Appearance].test(value))) {
      setSynced({ [key]: value || undefined })
      const { [key]: _, ...rest } = custom.value
      if (key in custom.value) setLocal(rest)
      return
    }
    setLocal({ ...custom.value, [key]: value || undefined })
  }

  function setSurface(mode: ThemeMode, key: SurfaceKey, value: string | undefined) {
    setLocal({ ...custom.value, [mode]: { ...custom.value[mode], [key]: value || undefined } })
  }

  /** A whole look at once (a preset, an imported theme): whatever it doesn't set goes back to the instance's */
  function apply(theme: ThemeOverride) {
    const { synced, local } = splitTheme(normalTheme(theme))
    const keepSize = $appearance.value.fontSize
    setSynced({ primary: synced.primary, font: synced.font, radius: synced.radius, fontSize: synced.fontSize ?? keepSize })
    setLocal(local)
  }

  function resetSection(section: ThemeSection) {
    const { keys, modes } = THEME_SECTIONS[section]
    for (const key of keys) set(key, undefined)
    if (modes.length) setLocal(Object.fromEntries(Object.entries(custom.value).filter(([key]) => !(modes as readonly string[]).includes(key))))
    announce(`${THEME_SECTIONS[section].label} back to the default`)
  }

  function resetAll() {
    // The background picture is a choice of its own, with its own Remove
    const background = settings.value.appearance?.background
    $appearance.value = {}
    custom.value = {}
    save({ appearance: background ? { background } : {} }, 'Back to the default look')
  }

  /** Has this section anything of the person's in it */
  function changed(section: ThemeSection) {
    const { keys, modes } = THEME_SECTIONS[section]
    return keys.some(key => !!current.value[key]) || modes.some(mode => Object.keys(current.value[mode] ?? {}).length > 0)
  }

  /** The current look as a card in the gallery. The text size is left out: a preset never sets it */
  function saveAsPreset(label: string) {
    const { fontSize: _, ...theme } = current.value
    const id = `custom-${Date.now().toString(36)}`
    saved.value = [...saved.value, { id, label: label.trim().slice(0, 40) || 'My look', theme }]
    return id
  }

  function removePreset(id: string) {
    saved.value = saved.value.filter(item => item.id !== id)
  }

  return { custom, saved, current, set, setSurface, apply, resetSection, resetAll, changed, saveAsPreset, removePreset }
}

export const useThemeEditor = createAppComposable(_useThemeEditor)
