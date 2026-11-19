<script setup lang="ts">
// Subjects the AI suggests, under the subject field: one click puts it in
const writing = useAiWriting()
const { subjects, suggestingSubjects } = writing
const { draft } = useComposer()
const tools = useComposerTools()

// Typed a subject of your own: the suggestions have had their turn
watch(() => draft.value.subject, (value) => {
  if (value.trim() && subjects.value.length && !subjects.value.includes(value)) subjects.value = []
})

function pick(subject: string) {
  writing.pickSubject(subject)
  tools.subjectInput.value?.focus()
}

function dismiss() {
  subjects.value = []
  tools.subjectInput.value?.focus()
}
</script>

<template>
  <Transition name="lb-collapse">
    <div v-if="subjects.length || suggestingSubjects">
      <div
        role="group"
        aria-label="Suggested subjects"
        class="flex min-h-10 items-center gap-1.5 overflow-x-auto border-b border-default bg-(--lb-ai-bg) ps-5 pe-2"
      >
        <UIcon
          name="i-lucide-sparkles"
          class="me-1 size-4 shrink-0 text-(--lb-ai)"
          :class="suggestingSubjects && 'animate-pulse'"
        />
        <p
          v-if="suggestingSubjects"
          role="status"
          class="flex-1 text-sm text-toned"
        >
          Suggesting subjects<span class="lb-ai-dots" />
        </p>
        <template v-else>
          <span class="sr-only">Suggested by AI:</span>
          <UButton
            v-for="(subject, index) in subjects"
            :key="subject"
            :label="subject"
            :aria-label="`Use subject: ${subject}`"
            color="neutral"
            variant="outline"
            size="xs"
            class="lb-stagger shrink-0 rounded-full bg-default"
            :style="{ '--lb-i': index }"
            @click="pick(subject)"
          />
          <UTooltip text="Dismiss suggestions">
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Dismiss subject suggestions"
              class="ms-auto shrink-0"
              @click="dismiss"
            />
          </UTooltip>
        </template>
      </div>
    </div>
  </Transition>
</template>
