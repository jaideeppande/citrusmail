// Settings → Desktop: what the app asks of the computer it's installed on.
// In a browser there's no desktop app to ask, and every call here does nothing
const _useDesktopSettings = () => {
  const prefs = usePrefs()
  const system = ref<DesktopSystem>()
  /** The shortcut couldn't be taken: another app has it */
  const quickComposeTaken = ref(false)

  async function refresh() {
    system.value = await desktop()?.getSystem().catch(() => undefined)
  }

  /** Hands the saved choices to the desktop app, which forgets them when it quits. Call once at startup */
  async function apply() {
    const app = desktop()
    if (!app) return
    app.setCloseToTray(prefs.value.closeToTray)
    if (prefs.value.quickCompose) quickComposeTaken.value = !(await app.setQuickCompose(prefs.value.quickCompose).catch(() => false))
  }

  async function setLoginItem(on: boolean) {
    await desktop()?.setLoginItem(on).catch(() => false)
    await refresh()
  }

  async function setDefaultMailto(on: boolean) {
    await desktop()?.setDefaultMailto(on).catch(() => false)
    await refresh()
  }

  function setCloseToTray(on: boolean) {
    prefs.value = { ...prefs.value, closeToTray: on }
    desktop()?.setCloseToTray(on)
  }

  /** Saved only when the system lets the app have it. An empty accelerator clears the shortcut */
  async function setQuickCompose(accelerator: string) {
    const app = desktop()
    if (!app) return false
    const taken = !(await app.setQuickCompose(accelerator).catch(() => false))
    if (accelerator && taken) {
      quickComposeTaken.value = true
      // The one that worked before is put back
      if (prefs.value.quickCompose) app.setQuickCompose(prefs.value.quickCompose).catch(() => false)
      return false
    }
    quickComposeTaken.value = false
    prefs.value = { ...prefs.value, quickCompose: accelerator }
    return true
  }

  return { system, quickComposeTaken, refresh, apply, setLoginItem, setDefaultMailto, setCloseToTray, setQuickCompose }
}

export const useDesktopSettings = createAppComposable(_useDesktopSettings)
