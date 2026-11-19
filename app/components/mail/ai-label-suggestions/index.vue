<script setup lang="ts">
// Labels the AI suggests for a message: dashed chips in the AI's violet,
// one click puts the label on, the cross waves it away. They sit outside
// the row's own button, so each is a control of its own
const props = defineProps<{
  message: MessageSummary
}>()

const ai = useAiLabels()
const suggestions = computed(() => ai.suggestionsOf(props.message))
</script>

<template>
  <ul
    v-if="suggestions.length"
    class="flex flex-wrap items-center gap-1.5"
    aria-label="Suggested labels"
  >
    <li
      v-for="label in suggestions"
      :key="label.id"
      class="inline-flex items-center rounded-full border border-dashed border-(--lb-ai)/50 bg-(--lb-ai-bg) text-xs text-toned lb-in-scale"
    >
      <UTooltip :text="`Add the label ${label.name}`">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-s-full ps-2 pe-1 py-0.5 hover:text-highlighted transition-colors duration-(--lb-dur-1) lb-focus lb-press"
          :aria-label="`Add suggested label ${label.name}`"
          @click.stop="ai.apply(message, label.id)"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="size-3 text-(--lb-ai)"
            aria-hidden="true"
          />
          <span
            class="size-2 rounded-full"
            :style="{ background: labelVar(label.color) }"
            aria-hidden="true"
          />
          {{ label.name }}
        </button>
      </UTooltip>
      <button
        type="button"
        class="grid place-items-center rounded-e-full ps-0.5 pe-1.5 py-0.5 text-muted hover:text-highlighted transition-colors duration-(--lb-dur-1) lb-focus"
        :aria-label="`Dismiss suggested label ${label.name}`"
        @click.stop="ai.dismiss(message, label.id)"
      >
        <UIcon
          name="i-lucide-x"
          class="size-3"
          aria-hidden="true"
        />
      </button>
    </li>
  </ul>
</template>
