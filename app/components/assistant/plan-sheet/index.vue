<script setup lang="ts">
import type { AiPlanAction } from '~/utils/ai-commands'

// What a command in plain English will do, before it does it: the plan in
// one sentence, anything worth a second look, and every message it found,
// each one ticked. Nothing changes until Confirm
const commands = useAiCommands()
const { isOpen, request, status, errors, plan, found, chosen, progress, picked, description, notes } = commands

const VERBS: Record<AiPlanAction['kind'], string> = {
  archive: 'Archive',
  delete: 'Delete',
  move: 'Move',
  markRead: 'Mark read',
  markUnread: 'Mark unread',
  flag: 'Flag',
  unflag: 'Unflag',
  label: 'Label',
  snooze: 'Snooze',
  pin: 'Pin',
  addToLater: 'Add to Later',
  none: 'Done'
}

const kind = computed(() => plan.value?.action.kind ?? 'none')
const showing = computed(() => kind.value === 'none')
const destructive = computed(() => kind.value === 'delete')
const confirmLabel = computed(() => `${VERBS[kind.value]} ${picked.value.length}`)

const allChecked = computed(() => found.value.length > 0 && chosen.value.size === found.value.length)
const someChecked = computed(() => chosen.value.size > 0 && !allChecked.value)

const cancelButton = useTemplateRef<{ $el: HTMLElement }>('cancelButton')

// Focus starts on Cancel: a stray Enter while the plan is still coming
// should never be what confirms it
let before: HTMLElement | null = null
watch(isOpen, (open) => {
  if (open) before = document.activeElement as HTMLElement | null
})
const content = {
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault()
    nextTick(() => cancelButton.value?.$el?.focus())
  },
  onCloseAutoFocus: (event: Event) => {
    event.preventDefault()
    // The palette that started it is gone by now; the panel's input or the page then
    if (before?.isConnected) before.focus()
    before = null
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Ask AI to do this"
    :description="`“${request}”`"
    :content="content"
    :ui="{ content: 'sm:max-w-xl', body: 'flex flex-col gap-4', footer: 'justify-end gap-2' }"
    @update:open="(open: boolean) => !open && commands.cancel()"
  >
    <template #body>
      <div
        v-if="status === 'planning' || status === 'searching'"
        class="relative flex flex-col gap-2 overflow-hidden rounded-lg bg-(--lb-ai-bg) px-4 py-3"
        aria-busy="true"
      >
        <div class="lb-ai-progress absolute inset-x-0 top-0 h-0.5" />
        <p class="flex items-center gap-2 text-sm text-toned">
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 shrink-0 text-(--lb-ai)"
          />
          <span v-if="status === 'planning'">Working out what you mean<span class="lb-ai-dots" /></span>
          <span v-else>Looking through your folders ({{ progress.done }} of {{ progress.total }})<span class="lb-ai-dots" /></span>
        </p>
      </div>

      <div
        v-else-if="status === 'error'"
        role="alert"
        class="flex gap-2 text-sm text-default"
      >
        <UIcon
          name="i-lucide-circle-alert"
          class="mt-0.5 size-4 shrink-0 text-error"
        />
        <div class="flex flex-col gap-1">
          <p class="font-medium text-highlighted">
            Nothing was changed.
          </p>
          <p
            v-for="error in errors"
            :key="error"
          >
            {{ error }}
          </p>
        </div>
      </div>

      <p
        v-else-if="!found.length"
        class="text-sm text-toned"
      >
        No messages match, so nothing will change.
      </p>

      <template v-else>
        <div class="flex flex-col gap-2">
          <p class="flex gap-2 text-base font-semibold text-highlighted">
            <UIcon
              name="i-lucide-sparkles"
              class="mt-1 size-4 shrink-0 text-(--lb-ai)"
            />
            <span>{{ description }}.</span>
          </p>
          <ul
            v-if="notes.length"
            class="flex flex-col gap-1 ps-6"
          >
            <li
              v-for="note in notes"
              :key="note"
              class="flex gap-2 text-sm"
              :class="note.startsWith('This is a lot') ? 'font-medium text-highlighted' : 'text-toned'"
            >
              <UIcon
                :name="note.startsWith('This is a lot') ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
                class="mt-0.5 size-4 shrink-0"
                :class="note.startsWith('This is a lot') ? 'text-warning' : 'text-muted'"
              />
              <span>{{ note }}</span>
            </li>
          </ul>
        </div>

        <div class="flex flex-col">
          <UCheckbox
            v-if="!showing"
            :model-value="someChecked ? 'indeterminate' : allChecked"
            :label="`All ${found.length} found`"
            class="border-b border-default px-1 pb-2"
            @update:model-value="commands.toggleAll()"
          />
          <ul
            class="-mx-1 max-h-72 overflow-y-auto py-1"
            :aria-label="showing ? 'Messages found' : 'Messages it will change'"
          >
            <li
              v-for="message in found"
              :key="messageKey(message)"
            >
              <button
                v-if="showing"
                type="button"
                class="lb-focus flex w-full min-w-0 flex-col rounded-md px-2 py-1.5 text-start hover:bg-elevated"
                @click="commands.show(message)"
              >
                <span class="flex w-full items-baseline gap-2 text-xs">
                  <span class="truncate font-medium text-highlighted">{{ personName(message.from) }}</span>
                  <time
                    :datetime="message.date"
                    class="ms-auto shrink-0 text-muted tabular-nums"
                  >{{ listDate(message.date) }}</time>
                </span>
                <span class="w-full truncate text-sm text-toned">{{ message.subject || '(No subject)' }}</span>
              </button>
              <UCheckbox
                v-else
                :model-value="chosen.has(messageKey(message))"
                class="rounded-md px-2 py-1.5 hover:bg-elevated"
                :ui="{ wrapper: 'min-w-0 flex-1', label: 'flex min-w-0 items-baseline gap-2 font-normal' }"
                @update:model-value="commands.toggle(message)"
              >
                <template #label>
                  <span class="w-40 shrink-0 truncate text-xs font-medium text-highlighted">{{ personName(message.from) }}</span>
                  <span class="min-w-0 flex-1 truncate text-sm text-toned">{{ message.subject || '(No subject)' }}</span>
                  <time
                    :datetime="message.date"
                    class="shrink-0 text-xs text-muted tabular-nums"
                  >{{ listDate(message.date) }}</time>
                </template>
              </UCheckbox>
            </li>
          </ul>
        </div>
      </template>
    </template>

    <template #footer>
      <UButton
        ref="cancelButton"
        :label="status === 'ready' && showing ? 'Close' : 'Cancel'"
        color="neutral"
        variant="ghost"
        @click="commands.cancel()"
      />
      <UButton
        v-if="status === 'ready' && found.length && !showing"
        :label="confirmLabel"
        :color="destructive ? 'error' : 'primary'"
        :icon="destructive ? 'i-lucide-trash-2' : 'i-lucide-check'"
        :disabled="!picked.length"
        @click="commands.confirm()"
      />
    </template>
  </UModal>
</template>
