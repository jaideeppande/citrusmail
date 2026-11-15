<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { IllustrationName } from '~/utils/illustrations'

// The app's one empty or error state: an illustration, a line saying what is
// (or isn't) here, an optional sentence on what to do, and the actions that
// do it. `actions` takes what UEmpty takes, so moving over is a rename
const props = withDefaults(defineProps<{
  illustration: IllustrationName
  title: string
  description?: string
  actions?: ButtonProps[]
  /** `sm` for narrow panes and popovers */
  size?: 'sm' | 'md'
  tone?: 'neutral' | 'error'
  /** The title's heading level: 1 when this is all the page shows */
  level?: 1 | 2 | 3
}>(), {
  description: undefined,
  actions: undefined,
  size: 'md',
  tone: 'neutral',
  level: 2
})

const small = computed(() => props.size === 'sm')
const heading = computed(() => `h${props.level}`)
</script>

<template>
  <!-- An error is said out loud as it appears; an empty list is not news -->
  <div
    class="flex min-w-0 flex-col items-center justify-center text-center lb-in-up"
    :class="small ? 'gap-1 px-3 py-6' : 'gap-1.5 px-6 py-10'"
    :role="tone === 'error' ? 'alert' : undefined"
    :style="tone === 'error' ? { '--lb-ill-accent': 'var(--ui-error)' } : undefined"
  >
    <Illustration
      :name="illustration"
      class="shrink-0"
      :class="small ? 'mb-2 w-24' : 'mb-3 w-36'"
    />
    <component
      :is="heading"
      class="font-semibold text-balance text-highlighted"
      :class="small ? 'text-sm' : 'text-base'"
    >
      {{ title }}
    </component>
    <p
      v-if="description"
      class="max-w-[40ch] text-pretty text-muted"
      :class="small ? 'text-xs' : 'text-sm'"
    >
      {{ description }}
    </p>
    <div
      v-if="actions?.length"
      class="flex flex-wrap items-center justify-center gap-2"
      :class="small ? 'mt-3' : 'mt-4'"
    >
      <UButton
        v-for="(action, index) in actions"
        :key="index"
        :size="small ? 'sm' : 'md'"
        v-bind="action"
      />
    </div>
    <slot />
  </div>
</template>
