// Settings → Notifications. Each change saves on its own, quietly
export function useNotificationSettings() {
  const { settings, save } = useSettings()
  const push = usePush()
  const toast = useToast()
  const prefs = computed<NotificationSettings>(() => ({ ...DEFAULT_NOTIFICATIONS, ...settings.value.notifications }))

  // Shown at once and then saved: waiting for the server, a second switch
  // flipped quickly was built on the old values and undid the first
  async function set(patch: Partial<NotificationSettings>) {
    const before = settings.value.notifications
    const notifications = { ...prefs.value, ...patch }
    settings.value = { ...settings.value, notifications }
    const saved = await save({ notifications }, false)
    if (!saved) settings.value = { ...settings.value, notifications: before }
    return saved
  }

  async function setBanners(on: boolean) {
    if (on && push.permission.value !== 'granted' && await push.askPermission() !== 'granted') {
      toast.add({ title: 'Banners are blocked for this site', description: 'Allow notifications in your browser’s site settings, then turn this on again.', color: 'warning', icon: 'i-lucide-bell-off' })
      return
    }
    set({ banners: on })
  }

  async function setPush(on: boolean) {
    if (!on) {
      await push.unsubscribe()
      return set({ push: false })
    }
    // Saved first: the server checks this before each push
    await set({ push: true })
    try {
      await push.subscribe()
    } catch (error) {
      await set({ push: false })
      toast.add({ title: 'Push couldn’t be turned on', description: (error as Error).message, color: 'warning', icon: 'i-lucide-bell-off', duration: 10_000 })
    }
  }

  // Renewed on each launch, so mailboxes added since, or a server that lost
  // the subscription, still get pushes
  function renewPush() {
    if (prefs.value.push && push.supported && push.permission.value === 'granted') push.subscribe().catch(() => {})
  }

  return { prefs, set, setBanners, setPush, renewPush, desktop: push.desktop, pushSupported: push.supported, permission: push.permission }
}
