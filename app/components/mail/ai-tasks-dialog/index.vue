<script setup lang="ts">
// The review of the to-dos the AI found: each one ticked, worded and dated
// as you like before it goes on the Later board. Mounted by the list and by
// the layout; only one of them shows it (useAiTasks().host)
const tasks = useAiTasks()
const shown = tasks.host()

const open = computed({
  get: () => shown.value && tasks.isOpen.value,
  set: (value) => {
    if (!value) tasks.close()
  }
})

const many = computed(() => tasks.messages.value.length > 1)
const subjectOf = (index: number) => tasks.messages.value[index]?.subject || '(No subject)'
const description = computed(() => many.value
  ? `From ${tasks.messages.value.length} messages. Tick the ones to add to Later; you can change the words and dates first.`
  : 'Tick the ones to add to Later; you can change the words and dates first.')
</script>

<template>
  <UModal
    v-model:open="open"
    title="Tasks found"
    :description="description"
    :ui="{ content: 'sm:max-w-xl lb-in-scale', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div
        v-if="tasks.status.value === 'finding'"
        class="flex flex-col gap-3"
        role="status"
        aria-live="polite"
      >
        <div
          class="h-0.5 w-full overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div class="h-full w-full lb-ai-progress" />
        </div>
        <p class="flex items-center gap-2 text-sm text-muted">
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 text-(--lb-ai)"
            aria-hidden="true"
          />
          <span class="lb-ai-dots">Reading {{ many ? `${tasks.messages.value.length} messages` : 'the message' }}</span>
        </p>
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-9 w-full"
        />
      </div>

      <div
        v-else-if="tasks.status.value === 'error'"
        class="flex flex-col items-start gap-3"
      >
        <p class="text-sm text-error">
          {{ tasks.error.value }}
        </p>
        <UButton
          label="Try again"
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tasks.extract(tasks.messages.value)"
        />
      </div>

      <p
        v-else-if="!tasks.tasks.value.length"
        class="flex items-center gap-2 text-sm text-toned"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-4 text-muted"
          aria-hidden="true"
        />
        No tasks found: nothing in {{ many ? 'these messages' : 'this message' }} asks for something to be done.
      </p>

      <ul
        v-else
        class="flex flex-col gap-2"
        aria-label="Tasks"
      >
        <li
          v-for="(task, index) in tasks.tasks.value"
          :key="index"
          class="flex items-start gap-3 rounded-md px-1 py-1.5 lb-stagger"
          :style="{ '--lb-i': index }"
        >
          <UCheckbox
            v-model="task.picked"
            :aria-label="`Add “${task.text}” to Later`"
            class="mt-2"
          />
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <UInput
                v-model="task.text"
                :aria-label="`Task ${index + 1}`"
                size="sm"
                class="flex-1"
                :maxlength="140"
              />
              <UInput
                :model-value="task.due ?? ''"
                type="date"
                size="sm"
                :aria-label="`Due date for task ${index + 1}`"
                class="w-38 shrink-0"
                @update:model-value="(value: string | number) => (task.due = validDay(String(value)))"
              />
            </div>
            <p
              v-if="task.who || many"
              class="flex flex-wrap items-center gap-x-3 text-xs text-muted"
            >
              <span
                v-if="task.who"
                class="inline-flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-user"
                  class="size-3"
                  aria-hidden="true"
                />For {{ task.who }}
              </span>
              <span
                v-if="many"
                class="inline-flex min-w-0 items-center gap-1"
              >
                <UIcon
                  name="i-lucide-mail"
                  class="size-3 shrink-0"
                  aria-hidden="true"
                /><span class="truncate">{{ subjectOf(task.source) }}</span>
              </span>
            </p>
          </div>
        </li>
      </ul>
    </template>

    <template #footer>
      <span class="me-auto inline-flex items-center gap-1 text-xs text-muted">
        <UIcon
          name="i-lucide-sparkles"
          class="size-3 text-(--lb-ai)"
          aria-hidden="true"
        />Found by AI
      </span>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="tasks.close()"
      />
      <UButton
        v-if="tasks.status.value === 'done' && tasks.tasks.value.length"
        :label="tasks.picked.value.length ? `Add ${tasks.picked.value.length} to Later` : 'Add to Later'"
        icon="i-lucide-square-kanban"
        :disabled="!tasks.picked.value.length"
        @click="tasks.addChosen()"
      />
    </template>
  </UModal>
</template>
