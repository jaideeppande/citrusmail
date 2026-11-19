<script setup lang="ts">
// What a typed phrase will create, on one line, before anything is saved:
// the quick reading straight away, the AI's once it is back. Create saves
// it as it reads, Edit opens the event form with it filled in
defineProps<{
  preview: string
  state: 'idle' | 'reading' | 'ai' | 'rules'
  note?: string
  reminder?: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: []
  dismiss: []
}>()
</script>

<template>
  <section
    class="relative flex flex-col gap-1.5 overflow-hidden rounded-md bg-(--lb-ai-bg) px-2.5 py-2"
    aria-label="New event preview"
    :aria-busy="state === 'reading'"
  >
    <span
      v-if="state === 'reading'"
      class="lb-ai-progress absolute inset-x-0 top-0 h-px"
      aria-hidden="true"
    />
    <p class="flex items-start gap-2 text-sm">
      <UIcon
        :name="state === 'ai' ? 'i-lucide-sparkles' : 'i-lucide-calendar-plus'"
        class="mt-0.5 size-4 shrink-0"
        :class="state === 'ai' ? 'text-(--lb-ai)' : 'text-muted'"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 text-highlighted">
        <span class="sr-only">{{ state === 'ai' ? 'Suggested by AI: ' : 'Will create: ' }}</span>{{ preview }}
      </span>
    </p>
    <p
      v-if="reminder"
      class="flex items-center gap-1.5 ps-6 text-xs text-muted"
    >
      <UIcon
        name="i-lucide-bell-off"
        class="size-3.5 shrink-0"
        aria-hidden="true"
      />
      Reminders aren’t supported yet
    </p>
    <p
      v-if="state === 'reading'"
      class="ps-6 text-xs text-muted"
    >
      Reading it with AI<span class="lb-ai-dots" />
    </p>
    <p
      v-else-if="note"
      class="ps-6 text-xs text-muted"
    >
      {{ note }}
    </p>
    <div class="flex items-center gap-1 ps-5">
      <UButton
        label="Create"
        icon="i-lucide-check"
        size="xs"
        class="lb-press"
        @click="emit('create')"
      />
      <UButton
        label="Edit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="emit('edit')"
      />
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Discard"
        class="ms-auto"
        @click="emit('dismiss')"
      />
    </div>
  </section>
</template>
