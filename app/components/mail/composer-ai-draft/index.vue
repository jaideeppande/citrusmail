<script setup lang="ts">
// The AI line above the editor for what useAiWriting does: "What should it
// say?" for a new message, the progress of anything being written, and
// once it lands, quick changes and Undo
const writing = useAiWriting()
const { busy, label, landed, instruction, canUndo } = writing
const { draft, editor } = useComposer()
const tools = useComposerTools()

const asking = computed(() => tools.aiDraft.value && !busy.value && !draft.value.replyingTo)
// Rewrites and corrections say how they went in a notice; this line only shows them under way
const shownLanded = computed(() => landed.value === 'draft' || landed.value === 'follow-up' || landed.value === 'meeting')
const shown = computed(() => asking.value || !!busy.value || (shownLanded.value && canUndo.value))

const field = useTemplateRef('field')
watch(asking, (value) => {
  if (value) nextTick(() => field.value?.inputRef?.focus())
}, { immediate: true })

function close() {
  tools.aiDraft.value = false
  editor.value?.commands.focus()
}

function done() {
  landed.value = undefined
  editor.value?.commands.focus()
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Only the line closes: the composer stays open
  event.preventDefault()
  event.stopPropagation()
  close()
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="shown">
      <div
        class="relative overflow-hidden border-b border-default bg-(--lb-ai-bg)"
        :aria-busy="!!busy"
      >
        <div
          v-if="busy"
          class="lb-ai-progress absolute inset-x-0 top-0 h-0.5"
          aria-hidden="true"
        />

        <div
          v-if="busy"
          class="flex min-h-11 items-center gap-2 px-5"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 shrink-0 animate-pulse text-(--lb-ai)"
          />
          <p
            class="flex-1 text-sm text-toned"
            role="status"
          >
            {{ label }}<span class="lb-ai-dots" />
          </p>
          <UButton
            label="Stop"
            icon="i-lucide-square"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="writing.stop()"
          />
        </div>

        <form
          v-else-if="asking"
          class="flex min-h-11 items-center gap-2 ps-5 pe-2"
          @submit.prevent="writing.writeDraft()"
          @keydown="onKey"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 shrink-0 text-(--lb-ai)"
          />
          <UInput
            ref="field"
            v-model="instruction"
            variant="none"
            placeholder="What should it say? A few words are enough"
            aria-label="What should the message say"
            maxlength="1000"
            class="flex-1"
            :ui="{ base: 'px-0 text-sm' }"
          />
          <UButton
            type="submit"
            label="Write draft"
            icon="i-lucide-sparkles"
            size="sm"
            color="neutral"
            variant="subtle"
            :disabled="!instruction.trim()"
          />
          <UTooltip
            text="Close"
            :kbds="['esc']"
          >
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Close AI draft"
              @click="close"
            />
          </UTooltip>
        </form>

        <div
          v-else
          role="group"
          aria-label="AI draft"
          class="flex items-center gap-1.5 overflow-x-auto py-2 ps-5 pe-2"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="me-1 size-4 shrink-0 text-(--lb-ai)"
          />
          <template v-if="landed === 'draft'">
            <UButton
              v-for="edit in DRAFT_EDITS"
              :key="edit.label"
              :label="edit.label"
              :icon="edit.icon"
              color="neutral"
              variant="outline"
              size="xs"
              class="shrink-0 rounded-full bg-default"
              @click="writing.reviseDraft(edit.change)"
            />
            <UButton
              label="Try again"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              size="xs"
              class="shrink-0 rounded-full bg-default"
              @click="writing.retryDraft()"
            />
          </template>
          <p
            v-else
            class="min-w-0 truncate text-sm text-toned"
          >
            {{ landed === 'meeting' ? 'Written with AI from your free times' : 'Written with AI' }}. Read it through before you send.
          </p>
          <div class="ms-auto flex shrink-0 items-center gap-0.5 ps-2">
            <UButton
              label="Undo"
              icon="i-lucide-undo-2"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="writing.undo()"
            />
            <UTooltip text="Keep it">
              <UButton
                icon="i-lucide-check"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Keep it and hide these options"
                @click="done"
              />
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
