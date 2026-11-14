<script setup lang="ts">
// A gallery of looks: each is an accent, a font and corners chosen to go
// together. Picking one sets those three, nothing more
const props = defineProps<{
  appearance: Appearance
}>()

const emit = defineEmits<{
  choose: [preset: ThemePreset]
}>()

const theme = useAppConfig().citrusmail.theme
const current = computed(() => matchingPreset(props.appearance, theme))
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Look"
    class="grid grid-cols-2 sm:grid-cols-4 gap-2"
  >
    <button
      v-for="(preset, index) in THEME_PRESETS"
      :key="preset.id"
      type="button"
      role="radio"
      :aria-checked="current?.id === preset.id"
      class="group lb-focus lb-stagger relative flex flex-col gap-3 rounded-lg p-3 text-start ring hover:bg-elevated/60"
      :class="current?.id === preset.id ? 'ring-2 ring-primary' : 'ring-default'"
      :style="{ '--lb-i': index }"
      @click="emit('choose', preset)"
    >
      <span
        class="flex items-center justify-between gap-2"
        aria-hidden="true"
      >
        <span
          class="text-2xl leading-none font-semibold text-highlighted"
          :style="{ fontFamily: preset.font ?? theme.font }"
        >Aa</span>
        <span
          class="h-5 w-9"
          :style="{ background: preset.primary ?? 'var(--color-post-600)', borderRadius: preset.radius ?? theme.radius }"
        />
      </span>
      <span class="flex items-center justify-between gap-1 text-sm font-medium text-highlighted">
        {{ preset.label }}
        <UIcon
          v-if="current?.id === preset.id"
          name="i-lucide-check"
          class="lb-mark-pop size-4 text-primary"
        />
      </span>
    </button>
  </div>
</template>
