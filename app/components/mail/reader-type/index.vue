<script setup lang="ts">
// The reader's "Aa" menu: how wide, how airy and in which typeface a message
// is set, and whether it sits on sepia paper. Kept on this computer
const type = useReaderType()

const WIDTHS: { value: ReaderType['width'], label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'default', label: 'Default' },
  { value: 'wide', label: 'Wide' }
]
const LEADINGS: { value: ReaderType['leading'], label: string }[] = [
  { value: 'tight', label: 'Tight' },
  { value: 'default', label: 'Default' },
  { value: 'loose', label: 'Loose' }
]
const FACES: { value: ReaderType['face'], label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' }
]

function set(change: Partial<ReaderType>) {
  type.value = { ...type.value, ...change }
}

const changed = computed(() => JSON.stringify(type.value) !== JSON.stringify(DEFAULT_READER_TYPE))
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UTooltip text="Text and paper">
      <UButton
        icon="i-lucide-a-large-small"
        color="neutral"
        variant="ghost"
        aria-label="Text and paper"
        class="lb-press"
      />
    </UTooltip>

    <template #content>
      <div class="w-64 p-3 flex flex-col gap-3">
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-xs font-medium text-muted">
            Text width
          </legend>
          <div class="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-elevated">
            <UButton
              v-for="option in WIDTHS"
              :key="option.value"
              :label="option.label"
              color="neutral"
              :variant="type.width === option.value ? 'solid' : 'ghost'"
              size="xs"
              block
              class="lb-press"
              :aria-pressed="type.width === option.value"
              @click="set({ width: option.value })"
            />
          </div>
        </fieldset>

        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-xs font-medium text-muted">
            Line height
          </legend>
          <div class="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-elevated">
            <UButton
              v-for="option in LEADINGS"
              :key="option.value"
              :label="option.label"
              color="neutral"
              :variant="type.leading === option.value ? 'solid' : 'ghost'"
              size="xs"
              block
              class="lb-press"
              :aria-pressed="type.leading === option.value"
              @click="set({ leading: option.value })"
            />
          </div>
        </fieldset>

        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-xs font-medium text-muted">
            Typeface
          </legend>
          <div class="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-elevated">
            <UButton
              v-for="option in FACES"
              :key="option.value"
              :label="option.label"
              color="neutral"
              :variant="type.face === option.value ? 'solid' : 'ghost'"
              size="xs"
              block
              class="lb-press"
              :class="option.value === 'serif' && 'lb-serif'"
              :aria-pressed="type.face === option.value"
              @click="set({ face: option.value })"
            />
          </div>
        </fieldset>

        <USwitch
          :model-value="type.sepia"
          label="Sepia paper"
          size="sm"
          @update:model-value="(on: boolean) => set({ sepia: on })"
        />

        <p class="text-xs text-muted">
          Typeface and line height apply to plain-text messages. Formatted mail keeps its own design.
        </p>

        <UButton
          v-if="changed"
          label="Back to the defaults"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="link"
          size="xs"
          class="self-start p-0"
          @click="type = { ...DEFAULT_READER_TYPE }"
        />
      </div>
    </template>
  </UPopover>
</template>
