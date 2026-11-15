<script setup lang="ts">
import type { SurfaceKey, ThemeKey, ThemeMode, ThemeSection } from '~/utils/theme-editor'

// Settings → Appearance → Customise: the whole theme, changed live, with the
// app drawn in it (light and dark side by side) always in view. Accent,
// font, text size and corners are saved with the account; greys, surfaces
// and the sheet stay on this computer (useThemeEditor says why)
const { $appearance, $theme } = useNuxtApp()
const editor = useThemeEditor()
const appConfig = useAppConfig()
const toast = useToast()
const { copy } = useClipboard({ legacy: true })
const { account } = useShell()
const { accentOf } = useMailboxAccents()

const fonts = computed(() => appConfig.citrusmail.fonts.map(font => ({ ...font, style: { fontFamily: font.value } })))
const value = (key: ThemeKey) => editor.current.value[key] ?? $theme.value[key]
const mailboxAccent = computed(() => account.value ? accentOf(account.value.email) : undefined)

// Colors are worked out where the previews are, so a `color-mix()` or a
// `var()` resolves exactly as it does on screen
const light = useTemplateRef<{ root: HTMLElement | null }>('light')
const dark = useTemplateRef<{ root: HTMLElement | null }>('dark')
const resolved = ref<Record<ThemeMode, Partial<Record<SurfaceKey, string>>>>({ light: {}, dark: {} })
const contrast = ref<Record<ThemeMode, ContrastPair[]>>({ light: [], dark: [] })

const PAIRS: { label: string, text: SurfaceKey, on: SurfaceKey }[] = [
  { label: 'Text on the sheet', text: 'text', on: 'sheet' },
  { label: 'Headings on the sheet', text: 'textHighlighted', on: 'sheet' },
  { label: 'Muted text on the sheet', text: 'textMuted', on: 'sheet' },
  { label: 'Text on the desk', text: 'text', on: 'desk' },
  { label: 'Muted text on the desk', text: 'textMuted', on: 'desk' },
  { label: 'Text on elevated', text: 'text', on: 'elevated' },
  { label: 'Muted text on elevated', text: 'textMuted', on: 'elevated' },
  { label: 'Headings on selected', text: 'textHighlighted', on: 'selected' }
]

function measure() {
  for (const mode of ['light', 'dark'] as const) {
    const root = (mode === 'light' ? light : dark).value?.root
    if (!root) continue
    const colors = $theme.value[mode]
    const sheet = resolveColor(colors.sheet, root)
    const hex = (key: SurfaceKey) => {
      const color = resolveColor(colors[key], root)
      // A see-through color is shown as it looks on the sheet
      return color && toHex(color[3] < 1 && sheet ? over(color, sheet) : color)
    }
    resolved.value[mode] = Object.fromEntries(SURFACE_FIELDS.map(field => [field.key, hex(field.key)]))
    const sheetHex = resolved.value[mode].sheet ?? '#ffffff'
    contrast.value[mode] = PAIRS.map(pair => ({ label: pair.label, ratio: contrastRatio(colors[pair.text], colors[pair.on], root, sheetHex) }))
  }
}
watch($theme, () => nextTick(measure), { deep: true })
onMounted(() => nextTick(measure))

function set(key: ThemeKey, next: string | undefined) {
  editor.set(key, next)
}

/** Each section's Reset, only while it has something of yours in it */
const SECTION_ORDER: ThemeSection[] = ['accent', 'greys', 'light', 'dark', 'shape', 'type']

async function copyJson() {
  await copy(themeJson(editor.current.value))
  toast.add({ title: 'Theme copied', description: 'Paste it into citrusmail.theme in app.config.ts, or into NUXT_PUBLIC_CITRUSMAIL_THEME.', icon: 'i-lucide-clipboard-check' })
  announce('Theme copied as JSON')
}

const importing = ref(false)
function onImport(theme: import('~/utils/theme').ThemeOverride) {
  editor.apply(theme)
  toast.add({ title: 'Theme imported', icon: 'i-lucide-check' })
}

const naming = ref(false)
const name = ref('')
watch(naming, on => on && (name.value = ''))
function savePreset() {
  if (!name.value.trim()) return
  editor.saveAsPreset(name.value)
  naming.value = false
  toast.add({ title: `“${name.value.trim()}” saved`, description: 'It’s at the end of the looks in Appearance.', icon: 'i-lucide-check' })
}

function resetAll() {
  editor.resetAll()
  announce('Theme back to the default')
}

useCommands(() => [{
  id: 'theme-editor',
  label: 'Theme',
  items: [
    { label: 'Copy theme as JSON', icon: 'i-lucide-clipboard-copy', onSelect: copyJson },
    { label: 'Import a theme', icon: 'i-lucide-file-input', onSelect: () => (importing.value = true) },
    { label: 'Reset the theme', icon: 'i-lucide-rotate-ccw', onSelect: resetAll }
  ]
}])
</script>

<template>
  <div class="flex flex-col gap-10">
    <!-- Always in view while the controls scroll under it -->
    <figure class="sticky top-0 z-10 -mx-5 -mt-7 border-b border-default bg-default/95 px-5 pt-5 pb-4 backdrop-blur sm:-mx-8 sm:px-8">
      <figcaption class="sr-only">
        A preview of the app in this theme, in light and dark mode
      </figcaption>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <UIcon
              name="i-lucide-sun"
              class="size-3.5"
            />
            Light
          </p>
          <SettingsThemePreview
            ref="light"
            :theme="$theme"
            mode="light"
          />
        </div>
        <div>
          <p class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <UIcon
              name="i-lucide-moon"
              class="size-3.5"
            />
            Dark
          </p>
          <SettingsThemePreview
            ref="dark"
            :theme="$theme"
            mode="dark"
          />
        </div>
      </div>
    </figure>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        label="Copy as JSON"
        icon="i-lucide-clipboard-copy"
        color="neutral"
        variant="outline"
        size="sm"
        @click="copyJson"
      />
      <UButton
        label="Import JSON"
        icon="i-lucide-file-input"
        color="neutral"
        variant="outline"
        size="sm"
        @click="importing = true"
      />
      <UPopover v-model:open="naming">
        <UButton
          label="Save as preset"
          icon="i-lucide-bookmark-plus"
          color="neutral"
          variant="outline"
          size="sm"
        />
        <template #content>
          <form
            class="flex w-72 flex-col gap-3 p-3"
            @submit.prevent="savePreset"
          >
            <UFormField
              label="Name"
              description="Kept on this computer, with the other looks."
            >
              <UInput
                v-model="name"
                maxlength="40"
                autofocus
                placeholder="My look"
              />
            </UFormField>
            <UButton
              type="submit"
              label="Save"
              size="sm"
              class="self-end"
              :disabled="!name.trim()"
            />
          </form>
        </template>
      </UPopover>
      <span class="flex-1" />
      <UButton
        label="Reset all"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="resetAll"
      />
    </div>

    <p class="-mt-6 flex items-start gap-2 text-sm text-muted">
      <UIcon
        name="i-lucide-hard-drive"
        class="mt-0.5 size-4 shrink-0"
      />
      Accent, font, text size and corners follow your account to other devices. Greys, surface colors and the sheet are kept on this computer.
    </p>

    <template
      v-for="section in SECTION_ORDER"
      :key="section"
    >
      <SettingsSection
        :title="THEME_SECTIONS[section].label"
        :description="section === 'accent' && mailboxAccent ? 'This mailbox has an accent of its own, set in Appearance, so the preview shows that one.' : section === 'greys' ? 'The family every surface is mixed from. Changing it re-tints the whole app.' : section === 'light' || section === 'dark' ? 'Leave a field empty to keep the default. Any CSS color works.' : undefined"
      >
        <template #actions>
          <UButton
            v-if="editor.changed(section)"
            label="Reset"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Reset ${THEME_SECTIONS[section].label.toLowerCase()}`"
            class="lb-in"
            @click="editor.resetSection(section)"
          />
        </template>

        <SettingsAccentPicker
          v-if="section === 'accent'"
          :model-value="$appearance.primary"
          @update:model-value="set('primary', $event)"
        />

        <UTabs
          v-else-if="section === 'greys'"
          :model-value="value('neutral')"
          :items="THEME_NEUTRALS"
          :content="false"
          color="neutral"
          size="sm"
          aria-label="Greys"
          class="w-md max-w-full"
          @update:model-value="set('neutral', $event as string)"
        />

        <template v-else-if="section === 'light' || section === 'dark'">
          <SettingsThemeSurfaces
            :mode="section"
            :resolved="resolved[section]"
          />
          <SettingsThemeContrast
            :mode="section"
            :pairs="contrast[section]"
            class="mt-2 rounded-md bg-elevated/60 px-3 py-2.5"
          />
        </template>

        <div
          v-else-if="section === 'shape'"
          class="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3"
        >
          <span
            id="theme-corners"
            class="text-sm text-toned"
          >Corners</span>
          <UTabs
            :model-value="value('radius')"
            :items="APPEARANCE_CORNERS"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="theme-corners"
            class="w-80 max-w-full"
            @update:model-value="set('radius', $event as string)"
          />
          <span
            id="theme-inset"
            class="text-sm text-toned"
          >Sheet inset</span>
          <UTabs
            :model-value="value('sheetInset')"
            :items="THEME_INSETS"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="theme-inset"
            class="w-80 max-w-full"
            @update:model-value="set('sheetInset', $event as string)"
          />
          <span
            id="theme-sheet-radius"
            class="text-sm text-toned"
          >Sheet corners</span>
          <UTabs
            :model-value="value('sheetRadius')"
            :items="THEME_SHEET_RADII"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="theme-sheet-radius"
            class="w-80 max-w-full"
            @update:model-value="set('sheetRadius', $event as string)"
          />
          <span
            id="theme-sheet-shadow"
            class="text-sm text-toned"
          >Sheet shadow</span>
          <UTabs
            :model-value="value('sheetShadow')"
            :items="THEME_SHEET_SHADOWS"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="theme-sheet-shadow"
            class="w-80 max-w-full"
            @update:model-value="set('sheetShadow', $event as string)"
          />
        </div>

        <div
          v-else
          class="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3"
        >
          <label
            for="theme-font"
            class="text-sm text-toned"
          >Font</label>
          <USelect
            id="theme-font"
            :model-value="value('font')"
            :items="fonts"
            class="w-72 max-w-full"
            @update:model-value="set('font', $event as string)"
          >
            <template #item-label="{ item }">
              <span :style="item.style">{{ item.label }}</span>
            </template>
          </USelect>
          <span
            id="theme-size"
            class="text-sm text-toned"
          >Text size</span>
          <UTabs
            :model-value="value('fontSize')"
            :items="APPEARANCE_SIZES"
            :content="false"
            color="neutral"
            size="sm"
            aria-labelledby="theme-size"
            class="w-96 max-w-full"
            @update:model-value="set('fontSize', $event as string)"
          />
        </div>
      </SettingsSection>
    </template>

    <SettingsThemeImport
      v-model:open="importing"
      @import="onImport"
    />
  </div>
</template>
