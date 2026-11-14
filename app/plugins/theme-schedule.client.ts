// Keeps the theme in step with the clock when Settings → Appearance says to
// follow the time of day. Looked at again every minute, and when the window
// comes back to the front: a laptop that slept through sunset wakes up dark
export default defineNuxtPlugin(() => {
  const { schedule, apply } = useThemeSchedule()

  // Also runs when another window turns the schedule on or changes its times
  watch(schedule, apply, { immediate: true, deep: true })
  setInterval(apply, 60_000)
  window.addEventListener('focus', apply)
  document.addEventListener('visibilitychange', () => !document.hidden && apply())
})
