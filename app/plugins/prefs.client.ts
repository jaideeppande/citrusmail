// Puts the choices kept on this computer onto the page: how much the app
// moves and how tightly its lists are packed. On <html>, so the stylesheet
// can answer them before anything is drawn
export default defineNuxtPlugin(() => {
  const prefs = usePrefs()
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  const motion = computed(() => prefs.value.motion === 'system'
    ? (systemReduced.value ? 'reduced' : 'full')
    : prefs.value.motion)

  watchEffect(() => {
    const root = document.documentElement
    root.dataset.motion = motion.value
    root.dataset.density = prefs.value.density
    root.dataset.window = windowKind()
    root.dataset.contrast = prefs.value.contrast
    root.dataset.text = prefs.value.largeText ? 'large' : 'normal'
  })

  return { provide: { motion } }
})
