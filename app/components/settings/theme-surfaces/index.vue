<script setup lang="ts">
import type { SurfaceKey, ThemeMode } from '~/utils/theme-editor'

// The surface colors of one mode, each with a color well and a field for
// any CSS color. A field left empty shows what the theme gives it instead
const props = defineProps<{
  mode: ThemeMode
  /** What each surface is now, as hex, worked out where the preview is */
  resolved: Partial<Record<SurfaceKey, string>>
}>()

const editor = useThemeEditor()
const id = useId()
const own = computed(() => editor.custom.value[props.mode] ?? {})
const errors = ref<Partial<Record<SurfaceKey, string>>>({})
const modeName = computed(() => props.mode === 'light' ? 'Light' : 'Dark')

/** The well moves continuously while dragged: saved a few times a second, not on every pixel */
const pick = useThrottleFn((key: SurfaceKey, value: string) => editor.setSurface(props.mode, key, value), 60, true)

function type(key: SurfaceKey, label: string, event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  const reason = value ? unsafeThemeValue(value) ?? (CSS.supports('color', value) ? undefined : 'isn’t a color') : undefined
  if (reason) {
    errors.value = { ...errors.value, [key]: `That ${reason}. Try a hex such as #1F2937.` }
    announce(`${label}: that ${reason}`, true)
    return
  }
  errors.value = { ...errors.value, [key]: undefined }
  if (value !== (own.value[key] ?? '')) editor.setSurface(props.mode, key, value || undefined)
}

function reset(key: SurfaceKey, label: string) {
  errors.value = { ...errors.value, [key]: undefined }
  editor.setSurface(props.mode, key, undefined)
  announce(`${label} back to the default`)
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_auto_9.5rem_1.75rem] items-center gap-x-3 gap-y-1.5">
    <template
      v-for="field in SURFACE_FIELDS"
      :key="field.key"
    >
      <label
        :for="`${id}-${field.key}`"
        class="min-w-0"
      >
        <span class="block text-sm text-highlighted">{{ field.label }}</span>
        <span class="block truncate text-xs text-muted">{{ field.hint }}</span>
      </label>
      <input
        type="color"
        :value="resolved[field.key] ?? '#000000'"
        :aria-label="`${modeName} ${field.label}, color well`"
        class="lb-focus lb-color-well"
        @input="pick(field.key, ($event.target as HTMLInputElement).value)"
      >
      <UInput
        :id="`${id}-${field.key}`"
        :model-value="own[field.key] ?? ''"
        :placeholder="resolved[field.key] ?? ''"
        size="sm"
        spellcheck="false"
        autocomplete="off"
        :color="errors[field.key] ? 'error' : 'primary'"
        :highlight="!!errors[field.key]"
        :aria-invalid="!!errors[field.key]"
        :aria-describedby="errors[field.key] ? `${id}-${field.key}-error` : undefined"
        :ui="{ base: 'font-mono text-xs' }"
        @change="type(field.key, field.label, $event)"
        @keydown.enter="type(field.key, field.label, $event)"
      />
      <UButton
        v-if="own[field.key]"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Reset ${modeName.toLowerCase()} ${field.label.toLowerCase()}`"
        class="lb-in"
        @click="reset(field.key, field.label)"
      />
      <span v-else />
      <p
        v-if="errors[field.key]"
        :id="`${id}-${field.key}-error`"
        class="col-span-4 -mt-0.5 mb-1 text-end text-xs text-error"
      >
        {{ errors[field.key] }}
      </p>
    </template>
  </div>
</template>
