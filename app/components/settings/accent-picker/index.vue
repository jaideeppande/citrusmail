<script setup lang="ts">
// Presets plus any color. `undefined` means the accent this falls back on:
// the instance's own, or for a mailbox, the general one
const model = defineModel<string | undefined>()

const props = withDefaults(defineProps<{
  /** What the first swatch, the one that clears the choice, is called */
  defaultLabel?: string
  /** And its color */
  defaultSwatch?: string
  /** Names the group for screen readers */
  label?: string
}>(), {
  defaultLabel: 'Default',
  defaultSwatch: 'var(--color-post-600)',
  label: 'Accent'
})

const PRESETS = computed(() => [
  { label: props.defaultLabel, value: undefined, swatch: props.defaultSwatch },
  { label: 'Blue', value: '#2563EB', swatch: '#2563EB' },
  { label: 'Indigo', value: '#5E6AD2', swatch: '#5E6AD2' },
  { label: 'Violet', value: '#7C3AED', swatch: '#7C3AED' },
  { label: 'Rose', value: '#E11D48', swatch: '#E11D48' },
  { label: 'Orange', value: '#EA580C', swatch: '#EA580C' },
  { label: 'Teal', value: '#0F766E', swatch: '#0F766E' },
  { label: 'Graphite', value: '#3F3F46', swatch: '#3F3F46' }
])

const custom = computed({
  get: () => model.value?.startsWith('#') ? model.value : '#0C7A57',
  set: value => (model.value = value)
})
const isCustom = computed(() => !!model.value && !PRESETS.value.some(preset => preset.value === model.value))

function choose(value: string | undefined, name: string) {
  model.value = value
  announce(`${name} chosen`)
}
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="flex flex-wrap items-center gap-1.5"
  >
    <UTooltip
      v-for="preset in PRESETS"
      :key="preset.label"
      :text="preset.label"
    >
      <UButton
        color="neutral"
        variant="ghost"
        :aria-label="preset.label"
        :aria-pressed="model === preset.value"
        class="size-8 justify-center rounded-full p-0 ring-2 ring-offset-2 ring-offset-(--ui-bg)"
        :class="model === preset.value ? 'ring-(--ui-border-inverted)' : 'ring-transparent'"
        @click="choose(preset.value, preset.label)"
      >
        <span
          class="size-6 rounded-full"
          :style="{ background: preset.swatch }"
        />
      </UButton>
    </UTooltip>

    <UPopover>
      <UButton
        :label="isCustom ? model : 'Custom'"
        icon="i-lucide-pipette"
        color="neutral"
        :variant="isCustom ? 'soft' : 'outline'"
        size="sm"
        :aria-label="isCustom ? `Custom accent, ${model}` : 'Custom accent'"
        :aria-pressed="isCustom"
        class="ms-1"
        :class="isCustom && 'font-mono'"
      />
      <template #content>
        <div class="p-3">
          <UColorPicker v-model="custom" />
        </div>
      </template>
    </UPopover>
  </div>
</template>
