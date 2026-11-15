<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()
const { $appearance, $theme } = useNuxtApp()
const editor = useThemeEditor()
const { mailboxes } = useMailboxes()

const fonts = computed(() => appConfig.citrusmail.fonts.map(font => ({ ...font, style: { fontFamily: font.value } })))

// How tightly lists are packed and how far you can zoom are kept on this computer
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
    announce(`${APPEARANCE_MODES.find(item => item.value === value)?.label} theme`)
  }
})

function setDensity(value: Density) {
  prefs.value = { ...prefs.value, density: value }
  announce(`${APPEARANCE_DENSITY.find(item => item.value === value)?.label} density`)
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <SettingsSection title="Theme">
      <UTabs
        v-model="mode"
        :items="modes"
        :content="false"
        color="neutral"
        size="sm"
        aria-label="Theme"
        class="max-w-full"
        :class="schedule.on ? 'w-md' : 'w-80'"
      />
      <SettingsThemeSchedule />
    </SettingsSection>

    <SettingsSection
      title="Look"
      description="A complete look in one choice. Change any part of it below, or every color in the theme editor."
    >
      <template #actions>
        <UButton
          label="Customise…"
          icon="i-lucide-swatch-book"
          color="neutral"
          variant="outline"
          size="sm"
          to="/settings/theme"
        />
      </template>
      <SettingsThemePresets />
    </SettingsSection>

    <SettingsSection title="Details">
      <div class="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-4 gap-y-5">
        <span
          id="appearance-accent"
          class="pt-1.5 text-sm text-toned"
        >Accent</span>
        <div>
          <SettingsAccentPicker
            :model-value="$appearance.primary"
            label="Accent"
            @update:model-value="editor.set('primary', $event)"
          />
          <p class="mt-2 text-sm text-muted">
            Buttons, links, the unread dot and the selected message.
          </p>
        </div>

        <label
          for="appearance-font"
          class="pt-1.5 text-sm text-toned"
        >Font</label>
        <USelect
          id="appearance-font"
          :model-value="$appearance.font ?? $theme.font"
          :items="fonts"
          class="w-72 max-w-full"
          @update:model-value="editor.set('font', $event as string)"
        >
          <template #item-label="{ item }">
            <span :style="item.style">{{ item.label }}</span>
          </template>
        </USelect>

        <span
          id="appearance-size"
          class="pt-1.5 text-sm text-toned"
        >Text size</span>
        <UTabs
          :model-value="$appearance.fontSize ?? $theme.fontSize"
          :items="APPEARANCE_SIZES"
          :content="false"
          color="neutral"
          size="sm"
          aria-labelledby="appearance-size"
          class="w-96 max-w-full"
          @update:model-value="editor.set('fontSize', $event as string)"
        />

        <span
          id="appearance-corners"
          class="pt-1.5 text-sm text-toned"
        >Corners</span>
        <UTabs
          :model-value="$appearance.radius ?? $theme.radius"
          :items="APPEARANCE_CORNERS"
          :content="false"
          color="neutral"
          size="sm"
          aria-labelledby="appearance-corners"
          class="w-80 max-w-full"
          @update:model-value="editor.set('radius', $event as string)"
        />

        <span
          id="appearance-density"
          class="pt-1.5 text-sm text-toned"
        >Density</span>
        <div>
          <UTabs
            :model-value="prefs.density"
            :items="APPEARANCE_DENSITY"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="appearance-density"
            class="w-md max-w-full"
            @update:model-value="setDensity($event as Density)"
          />
          <p class="mt-2 text-sm text-muted">
            How much room each message gets in the list. Kept on this computer.
          </p>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      v-if="mailboxes.length > 1"
      title="Accent for each mailbox"
      description="So it’s plain at a glance which mailbox is open. Kept on this computer."
    >
      <SettingsMailboxAccents />
    </SettingsSection>

    <SettingsMotionChoice />

    <SettingsSection
      v-if="isDesktop"
      title="Zoom"
      description="This window. Other windows keep their own."
    >
      <SettingsZoom />
    </SettingsSection>

    <SettingsSection
      title="Background"
      description="A picture of your own behind the app. The page you read on stays solid."
    >
      <SettingsBackground />
    </SettingsSection>

    <div class="flex flex-wrap items-center gap-3 border-t border-default pt-6">
      <UButton
        label="Reset to default"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="outline"
        @click="editor.resetAll()"
      />
      <p class="text-sm text-muted">
        Puts back the look this app came with. Your background stays.
      </p>
    </div>
  </div>
</template>
