<script setup lang="ts">
// What goes under your words: the signature and, for a reply or forward, the
// original. Both are sent as they are, outside the editor
const { draft } = useComposer()
const { htmlOf, labelOf, choiceOf } = useSignatures()

const signature = computed(() => htmlOf(draft.value))

const showQuote = ref(false)
const isForward = computed(() => /^fwd:/i.test(draft.value.subject))
</script>

<template>
  <div class="flex flex-col gap-3 px-5 pb-4">
    <div
      v-if="signature"
      class="group relative max-w-full overflow-x-auto"
      :aria-label="`Signature: ${labelOf(choiceOf(draft))}`"
      role="group"
    >
      <!-- The default one is sanitized by the server when it was saved; the
           others were written in this app's editor, which keeps only its own markup -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="text-sm text-toned [&_a]:text-primary [&_img]:inline-block"
        v-html="signature"
      />
      <!-- eslint-enable vue/no-v-html -->
      <UTooltip text="Leave out the signature">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="soft"
          size="xs"
          aria-label="Leave out the signature"
          class="absolute top-0 end-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          @click="draft.signature = false"
        />
      </UTooltip>
    </div>

    <template v-if="draft.quoteText">
      <UButton
        v-if="!showQuote && !isForward"
        icon="i-lucide-ellipsis"
        color="neutral"
        variant="soft"
        size="xs"
        aria-label="Show the quoted message"
        class="self-start"
        @click="showQuote = true"
      />
      <blockquote
        v-else
        class="border-s-2 border-default ps-3 text-sm text-muted whitespace-pre-line wrap-anywhere line-clamp-[40]"
      >
        {{ draft.quoteText }}
      </blockquote>
    </template>
  </div>
</template>
