<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()
const { $appearance } = useNuxtApp()
const { save } = useSettings()

const theme = appConfig.citrusmail.theme
const fonts = computed(() => appConfig.citrusmail.fonts.map(font => ({ ...font, style: { fontFamily: font.value } })))

// Changes show at once and are saved a moment later
function set<K extends keyof Appearance>(key: K, value: Appearance[K]) {
  $appearance.value = { ...$appearance.value, [key]: value }
  persist()
}
const persist = useDebounceFn(() => save({ appearance: { ...$appearance.value } }, 'Appearance saved'), 800)

/** Several choices at once, as a preset makes them */
function apply(patch: Appearance) {
  $appearance.value = { ...$appearance.value, ...patch }
  persist()
}

// How much moves and how tightly lists are packed are kept on this computer
const prefs = usePrefs()
const isDesktop = !!desktop()

// While the theme follows the clock, a fourth tab says so; picking one of
// the others takes it back into your own hands
const { schedule, turnOff } = useThemeSchedule()
const modes = computed(() => schedule.value.on
  ? [...APPEARANCE_MODES, { label: 'Scheduled', value: 'scheduled', icon: 'i-lucide-clock' }]
  : APPEARANCE_MODES)
const mode = computed({
  get: () => schedule.value.on ? 'scheduled' : colorMode.preference,
  set: (value: string) => {
    if (value === 'scheduled') return
    if (schedule.value.on) turnOff(value)
    else colorMode.preference = value
  }
})

function reset() {
  $appearance.value = {}
  save({ appearance: {} }, 'Back to the default look')
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <UFormField label="Theme">
      <UTabs
        v-model="mode"
        :items="modes"
        :content="false"
        color="neutral"
        size="sm"
        class="max-w-full"
        :class="schedule.on ? 'w-md' : 'w-80'"
      />
      <SettingsThemeSchedule class="mt-4" />
    </UFormField>

    <UFormField
      label="Look"
      description="An accent, a font and corners that go together. Change any of them below."
    >
      <SettingsThemePresets
        :appearance="$appearance"
        class="mt-2"
        @choose="apply({ primary: $event.primary, font: $event.font, radius: $event.radius })"
      />
    </UFormField>

    <UFormField
      label="Accent"
      description="Buttons, links, the unread dot and the selected message."
    >
      <SettingsAccentPicker
        :model-value="$appearance.primary"
        class="mt-1"
        @update:model-value="set('primary', $event)"
      />
    </UFormField>

    <UFormField label="Font">
      <USelect
        :model-value="$appearance.font ?? theme.font"
        :items="fonts"
        class="w-72"
        @update:model-value="set('font', $event as string)"
      >
        <template #item-label="{ item }">
          <span :style="item.style">{{ item.label }}</span>
        </template>
      </USelect>
    </UFormField>

    <UFormField label="Text size">
      <UTabs
        :model-value="$appearance.fontSize ?? theme.fontSize"
        :items="APPEARANCE_SIZES"
        :content="false"
        color="neutral"
        size="sm"
        class="w-80 max-w-full"
        @update:model-value="set('fontSize', $event as string)"
      />
    </UFormField>

    <UFormField label="Corners">
      <UTabs
        :model-value="$appearance.radius ?? theme.radius"
        :items="APPEARANCE_CORNERS"
        :content="false"
        color="neutral"
        size="sm"
        class="w-80 max-w-full"
        @update:model-value="set('radius', $event as string)"
      />
    </UFormField>

    <UFormField
      label="Density"
      description="How much room each message gets in the list."
    >
      <UTabs
        :model-value="prefs.density"
        :items="APPEARANCE_DENSITY"
        :content="false"
        color="neutral"
        size="sm"
        class="w-md max-w-full mt-1"
        @update:model-value="prefs = { ...prefs, density: $event as Density }"
      />
    </UFormField>

    <UFormField
      label="Motion"
      description="System follows your computer’s own Reduce motion setting."
    >
      <UTabs
        :model-value="prefs.motion"
        :items="APPEARANCE_MOTION"
        :content="false"
        color="neutral"
        size="sm"
        class="w-96 max-w-full mt-1"
        @update:model-value="prefs = { ...prefs, motion: $event as MotionLevel }"
      />
      <SettingsMotionPreview class="mt-3" />
    </UFormField>

    <UFormField
      v-if="isDesktop"
      label="Zoom"
      description="This window. Other windows keep their own."
    >
      <SettingsZoom class="mt-1" />
    </UFormField>

    <UFormField
      label="Background"
      description="A picture of your own behind the app. The page you read on stays solid."
    >
      <SettingsBackground class="mt-2" />
    </UFormField>

    <UButton
      label="Reset to default"
      icon="i-lucide-rotate-ccw"
      color="neutral"
      variant="outline"
      class="self-start"
      @click="reset"
    />
  </div>
</template>
