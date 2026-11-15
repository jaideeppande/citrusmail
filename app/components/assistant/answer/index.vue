<script setup lang="ts">
// An AI answer, laid out for reading. It is plain text from the model, so it
// is only ever text here: lines become paragraphs, "- " lines a list
const props = defineProps<{
  text: string
}>()

const blocks = computed(() => answerBlocks(props.text))
</script>

<template>
  <div class="flex flex-col gap-2 text-sm text-default leading-relaxed wrap-anywhere">
    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <p v-if="block.kind === 'paragraph'">
        {{ block.text }}
      </p>
      <ul
        v-else
        class="flex flex-col gap-1"
      >
        <li
          v-for="(item, at) in block.items"
          :key="at"
          class="flex gap-2"
        >
          <span
            class="mt-2 size-1 shrink-0 rounded-full bg-(--lb-ai)"
            aria-hidden="true"
          />
          <span>{{ item }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>
