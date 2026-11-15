// The palette's way to the choices in Settings → Accessibility and the theme
// editor: "contrast", "larger", "theme" find them from anywhere
export function useAccessibilityCommands() {
  const prefs = usePrefs()

  function toggleContrast() {
    const high = prefs.value.contrast !== 'high'
    prefs.value = { ...prefs.value, contrast: high ? 'high' : 'normal' }
    announce(high ? 'Contrast increased' : 'Contrast back to normal')
  }

  function toggleLarge() {
    const large = !prefs.value.largeText
    prefs.value = { ...prefs.value, largeText: large }
    announce(large ? 'Larger text and controls on' : 'Larger text and controls off')
  }

  useCommands(() => [{
    id: 'accessibility',
    label: 'Accessibility',
    items: [
      { label: prefs.value.contrast === 'high' ? 'Normal contrast' : 'Increase contrast', icon: 'i-lucide-contrast', onSelect: toggleContrast },
      { label: prefs.value.largeText ? 'Normal text and controls' : 'Larger text and controls', icon: 'i-lucide-a-large-small', onSelect: toggleLarge },
      { label: 'Accessibility settings', icon: 'i-lucide-accessibility', onSelect: () => navigateTo('/settings/accessibility') },
      ...(useAppConfig().citrusmail.allowAppearance ? [{ label: 'Customise the theme', icon: 'i-lucide-swatch-book', onSelect: () => navigateTo('/settings/theme') }] : [])
    ]
  }])
}
