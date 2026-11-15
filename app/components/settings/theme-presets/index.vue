<script setup lang="ts">
// A gallery of looks, each drawn as a small copy of the app wearing it.
// Picking one puts on everything it sets and takes off what it doesn't.
// Looks saved from the theme editor sit at the end, each with a way to
// delete it. One radio group: the arrow keys move between the cards
const { $appearance, $baseTheme } = useNuxtApp()
const editor = useThemeEditor()
const colorMode = useColorMode()
const themeSchedule = useThemeSchedule()

const presets = computed(() => [...THEME_PRESETS, ...editor.saved.value.map(presetFromSaved)])
const current = computed(() => matchingPreset($appearance.value, $baseTheme.value, editor.custom.value, presets.value))
/** The card that takes the tab key: the chosen one, or the first */
const focusable = computed(() => current.value?.id ?? presets.value[0]?.id)

const isDark = computed(() => colorMode.value === 'dark')
const modeOf = (preset: ThemePreset) => preset.scheme ?? (isDark.value ? 'dark' : 'light')
const themeOf = (preset: ThemePreset) => mergeTheme($baseTheme.value, presetTheme(preset))

function choose(preset: ThemePreset) {
  editor.apply(presetTheme(preset))
  // A look drawn for the dark is worn in the dark
  if (preset.scheme && colorMode.preference !== preset.scheme) {
    if (themeSchedule.schedule.value.on) themeSchedule.turnOff(preset.scheme)
    else colorMode.preference = preset.scheme
  }
  announce(`${preset.label} look chosen`)
}

const cards = useTemplateRef<HTMLButtonElement[]>('cards')

function onKeydown(event: KeyboardEvent, index: number) {
  const last = presets.value.length - 1
  const to = {
    ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last
  }[event.key]
  if (to === undefined) return
  event.preventDefault()
  const next = to > last ? 0 : to < 0 ? last : to
  cards.value?.[next]?.focus()
  choose(presets.value[next]!)
}

function remove(preset: ThemePreset) {
  editor.removePreset(preset.id)
  announce(`${preset.label} deleted`)
}
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Look"
    class="grid grid-cols-2 gap-2 sm:grid-cols-4"
  >
    <div
      v-for="(preset, index) in presets"
      :key="preset.id"
      class="group lb-stagger relative"
      :style="{ '--lb-i': index }"
    >
      <button
        ref="cards"
        type="button"
        role="radio"
        :aria-checked="current?.id === preset.id"
        :tabindex="focusable === preset.id ? 0 : -1"
        :aria-label="[preset.label, preset.scheme === 'dark' && 'dark', preset.contrast && 'high contrast', preset.custom && 'yours'].filter(Boolean).join(', ')"
        class="lb-focus flex w-full flex-col gap-2 rounded-lg p-1.5 text-start ring transition-shadow duration-(--lb-dur-1) hover:bg-elevated/60"
        :class="current?.id === preset.id ? 'ring-2 ring-primary' : 'ring-default'"
        @click="choose(preset)"
        @keydown="onKeydown($event, index)"
      >
        <SettingsThemePreview
          :theme="themeOf(preset)"
          :mode="modeOf(preset)"
          compact
        />
        <span class="flex min-w-0 items-center gap-1.5 px-1 pb-0.5 text-sm font-medium text-highlighted">
          <span class="truncate">{{ preset.label }}</span>
          <UIcon
            v-if="preset.scheme === 'dark'"
            name="i-lucide-moon"
            class="size-3.5 shrink-0 text-muted"
          />
          <UIcon
            v-if="preset.contrast"
            name="i-lucide-contrast"
            class="size-3.5 shrink-0 text-muted"
          />
          <span class="flex-1" />
          <UIcon
            v-if="current?.id === preset.id"
            name="i-lucide-check"
            class="lb-mark-pop size-4 shrink-0 text-primary"
          />
        </span>
      </button>
      <UTooltip
        v-if="preset.custom"
        :text="`Delete ${preset.label}`"
      >
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="soft"
          size="xs"
          :aria-label="`Delete ${preset.label}`"
          class="absolute end-2.5 top-2.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          @click="remove(preset)"
        />
      </UTooltip>
    </div>
  </div>
</template>
