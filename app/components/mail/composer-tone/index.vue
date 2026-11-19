<script setup lang="ts">
// Tone rewrite: the message you wrote, made shorter, friendlier, more formal
// or changed the way you say, and spelling and grammar put right. A reply is
// rewritten by AI Reply, which reads the message being answered; a new
// message goes to this computer's AI on its own. Corrections come as a
// preview to accept (mail/composer-proofread) rather than straight in
const { draft } = useComposer()
const reply = useAiReply()
const writing = useAiWriting()
const client = useAiClient()
const { tone: open } = useComposerTools()

const instruction = ref('')
watch(open, (value) => {
  if (value) instruction.value = ''
})

const isReply = computed(() => !!draft.value.replyingTo)
const hasWords = computed(() => !!draft.value.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim())
const busy = computed(() => reply.writing.value || !!writing.busy.value)
const canProofread = computed(() => client.enabled('proofread'))
const canUndo = computed(() => (isReply.value && reply.previous.value !== undefined) || writing.canUndo.value)
const tip = computed(() => hasWords.value ? 'Rewrite with AI' : 'Write your message first, then rewrite it')

function run(change: string) {
  if (!change.trim()) return
  open.value = false
  if (isReply.value) reply.rewrite(change.trim())
  else writing.rewrite(change.trim())
}

function fix() {
  open.value = false
  if (canProofread.value) writing.proofread()
  else if (isReply.value) reply.rewrite(GRAMMAR_EDIT.change)
}

function undo() {
  open.value = false
  if (isReply.value && reply.previous.value !== undefined) reply.undoRewrite()
  else writing.undo()
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
          :disabled="!hasWords || busy"
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
          {{ isReply ? 'Rewrite your reply' : 'Rewrite your message' }}
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
          <li
            v-if="canProofread || isReply"
            class="lb-stagger"
            :style="{ '--lb-i': TONE_EDITS.length }"
          >
            <UButton
              :label="GRAMMAR_EDIT.label"
              :icon="GRAMMAR_EDIT.icon"
              color="neutral"
              variant="ghost"
              size="sm"
              block
              class="justify-start"
              @click="fix"
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
          v-if="canUndo"
          class="border-t border-default p-1"
        >
          <UButton
            label="Undo the last AI change"
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
