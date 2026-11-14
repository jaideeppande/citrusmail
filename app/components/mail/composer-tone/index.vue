<script setup lang="ts">
// Tone rewrite: the reply you wrote, made shorter, friendlier, more formal
// or just corrected, or changed the way you say. The AI needs the message
// being answered, so for now this works on replies only
const { draft } = useComposer()
const { writing, previous, rewrite, undoRewrite } = useAiReply()
const { tone: open } = useComposerTools()

const instruction = ref('')
watch(open, (value) => {
  if (value) instruction.value = ''
})

const isReply = computed(() => !!draft.value.replyingTo)
const hasWords = computed(() => !!draft.value.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim())
const tip = computed(() => {
  if (!isReply.value) return 'Rewriting works on replies for now: it reads the message you’re answering'
  return hasWords.value ? 'Rewrite with AI' : 'Write your reply first, then rewrite it'
})

function run(change: string) {
  if (!change.trim()) return
  open.value = false
  rewrite(change.trim())
}

function undo() {
  open.value = false
  undoRewrite()
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'top', align: 'start' }"
    :ui="{ content: 'w-72 p-0' }"
  >
    <UTooltip :text="tip">
      <!-- A disabled button gets no hover, so the tooltip sits on this wrapper -->
      <span class="inline-flex">
        <UButton
          icon="i-lucide-wand-sparkles"
          color="neutral"
          variant="ghost"
          aria-label="Rewrite with AI"
          :disabled="!isReply || !hasWords || writing"
          :class="open && 'text-(--lb-ai)'"
        />
      </span>
    </UTooltip>

    <template #content>
      <div class="flex flex-col">
        <p class="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-medium text-muted">
          <UIcon
            name="i-lucide-sparkles"
            class="size-3.5 text-(--lb-ai)"
          />
          Rewrite your reply
        </p>
        <ul class="p-1">
          <li
            v-for="(edit, index) in TONE_EDITS"
            :key="edit.label"
            class="lb-stagger"
            :style="{ '--lb-i': index }"
          >
            <UButton
              :label="edit.label"
              :icon="edit.icon"
              color="neutral"
              variant="ghost"
              size="sm"
              block
              class="justify-start"
              @click="run(edit.change)"
            />
          </li>
        </ul>
        <form
          class="flex items-center gap-1 border-t border-default ps-3 pe-1.5"
          @submit.prevent="run(instruction)"
        >
          <UInput
            v-model="instruction"
            variant="none"
            placeholder="Or say how to change it"
            aria-label="How to change it"
            maxlength="500"
            class="flex-1"
            :ui="{ base: 'px-0 h-10 text-sm' }"
          />
          <UButton
            type="submit"
            icon="i-lucide-corner-down-left"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Rewrite"
            :disabled="!instruction.trim()"
          />
        </form>
        <div
          v-if="previous !== undefined"
          class="border-t border-default p-1"
        >
          <UButton
            label="Undo the last rewrite"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            class="justify-start"
            @click="undo"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
