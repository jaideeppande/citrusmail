<script setup lang="ts">
import type { AiFeature } from '~/utils/ai-features'

// Each AI feature with its switch, and what it sends to your provider. The
// ones that run on their own say so
const props = defineProps<{
  /** Only the features that run on their own */
  background?: boolean
}>()

const ai = useAiClient()

const groups = computed(() => {
  const list = AI_FEATURES.filter(feature => props.background === undefined || feature.background === props.background)
  const byGroup = new Map<string, AiFeature[]>()
  for (const feature of list) byGroup.set(feature.group, [...(byGroup.get(feature.group) ?? []), feature])
  return [...byGroup].map(([title, items]) => ({ title, items }))
})

const isOn = (feature: AiFeature) => ai.switches.value[feature.id] !== false
function set(feature: AiFeature, on: boolean) {
  ai.setEnabled(feature.id, on)
  announce(`${feature.label} ${on ? 'on' : 'off'}`)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <section
      v-for="group in groups"
      :key="group.title"
      :aria-label="group.title"
    >
      <h3 class="text-xs font-medium text-muted mb-1.5">
        {{ group.title }}
      </h3>
      <ul class="flex flex-col divide-y divide-default border-y border-default">
        <li
          v-for="feature in group.items"
          :key="feature.id"
          class="flex items-start gap-3 py-2.5"
        >
          <div class="flex-1 min-w-0">
            <p class="flex flex-wrap items-center gap-x-2 text-sm font-medium text-highlighted">
              {{ feature.label }}
              <UBadge
                v-if="feature.background"
                label="Runs on its own"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </p>
            <p class="text-xs text-muted text-pretty mt-0.5">
              Sends: {{ feature.sends }}.
            </p>
          </div>
          <USwitch
            :model-value="isOn(feature)"
            :aria-label="feature.label"
            class="mt-0.5"
            @update:model-value="set(feature, $event)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
