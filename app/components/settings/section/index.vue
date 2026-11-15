<script setup lang="ts">
// One group of settings under a heading: the same rhythm on every tab. As a
// fieldset when its controls answer one question, so the heading is read
// with each of them
const props = defineProps<{
  title: string
  description?: string
  /** A fieldset with a legend instead of a section with a heading */
  fieldset?: boolean
}>()

const id = useId()
</script>

<template>
  <component
    :is="props.fieldset ? 'fieldset' : 'section'"
    :aria-labelledby="props.fieldset ? undefined : `${id}-title`"
    :aria-describedby="description ? `${id}-description` : undefined"
    class="flex min-w-0 flex-col gap-4"
  >
    <component
      :is="props.fieldset ? 'legend' : 'div'"
      class="contents"
    >
      <div class="flex items-baseline gap-3">
        <h2
          :id="`${id}-title`"
          class="flex-1 text-sm font-semibold text-highlighted"
        >
          {{ title }}
        </h2>
        <slot name="actions" />
      </div>
    </component>
    <p
      v-if="description"
      :id="`${id}-description`"
      class="-mt-3 text-sm text-muted"
    >
      {{ description }}
    </p>
    <slot />
  </component>
</template>
