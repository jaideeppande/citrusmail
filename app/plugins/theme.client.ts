import colors from 'tailwindcss/colors'
import type { Appearance, CitrusMailTheme, ThemeOverride } from '~/utils/theme'
import { cleanThemeOverride } from '~/utils/theme-editor'

const BUILT_IN = new Set(Object.keys(colors))

/**
 * Applies the theme, in layers: app.config defaults, then
 * NUXT_PUBLIC_CITRUSMAIL_THEME, then the person's own Appearance choices
 * (saved with their account, and remembered in this browser so the first
 * paint is already right), then what the theme editor keeps on this computer
 * (greys, surfaces, the sheet), then the accent chosen for the mailbox that's
 * open. Written as CSS custom properties
 */
export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const config = useRuntimeConfig().public
  const pickTheme = (value?: ThemeOverride | string) => typeof value === 'string' ? value.trim() : value && Object.keys(value).length ? value : undefined
  const runtime = {
    theme: pickTheme((config.citrusmail as { theme?: ThemeOverride | string } | undefined)?.theme)
  }
  renameStoredKey('letterbox-appearance', 'citrusmail-appearance')
  const appearance = useLocalStorage<Appearance>('citrusmail-appearance', {})
  const custom = useLocalPref<ThemeOverride>('theme-custom', {})
  const mailboxAccents = useLocalPref<Record<string, string>>('mailbox-accents', {})
  const { user } = useUserSession()

  const envTheme = computed<ThemeOverride | undefined>(() => {
    const value = runtime.theme
    if (!value) return undefined
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value) as ThemeOverride
    } catch {
      console.warn('[CitrusMail] NUXT_PUBLIC_CITRUSMAIL_THEME is not valid JSON')
      return undefined
    }
  })

  /** The instance's look, before anyone's own choices: what the presets are drawn on */
  const baseTheme = computed<CitrusMailTheme>(() => mergeTheme(appConfig.citrusmail.theme as CitrusMailTheme, envTheme.value))

  // Local storage can be edited by hand, so what comes back from it is held
  // to the same rules as a pasted theme before it reaches a stylesheet
  const personal = computed<ThemeOverride[]>(() => {
    if (!appConfig.citrusmail.allowAppearance) return []
    const email = (user.value as { email?: string } | null)?.email?.toLowerCase() ?? ''
    const accent = cleanThemeOverride({ primary: mailboxAccents.value[email] })
    return [cleanThemeOverride(appearance.value), cleanThemeOverride(custom.value), accent]
  })

  const theme = computed<CitrusMailTheme>(() => mergeTheme(baseTheme.value, ...personal.value))

  // Palette names go through Nuxt UI, which knows every Tailwind color; a hex
  // accent is mixed into a full scale by themeCss
  watchEffect(() => {
    const { primary, neutral } = theme.value
    if (!isHexColor(primary)) appConfig.ui.colors.primary = BUILT_IN.has(primary) ? primary : 'post'
    appConfig.ui.colors.neutral = neutral
  })

  useHead({
    style: [{ id: 'citrusmail-theme', innerHTML: () => themeCss(theme.value, BUILT_IN), tagPriority: 'low' }],
    // Loaded last, so brand/custom.css (served by server/routes/custom.css.ts) wins over everything
    link: [{ rel: 'stylesheet', href: '/custom.css', key: 'citrusmail-custom', tagPriority: 'low' }]
  })

  return { provide: { appearance, theme, baseTheme } }
})
