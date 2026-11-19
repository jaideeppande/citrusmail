<script setup lang="ts">
// The assistant: a chat slid over the right of the window, about the open
// conversation or about your mail, and in "Do something" a way to act on
// mail by saying what to do. Mounted once by the layout, with the sheet that
// confirms commands, which the palette uses too
const assistant = useAssistant()
const { isOpen, mode, context, turns, busy, canAsk, available } = assistant
const ai = useAiClient()
const commands = useAiCommands()

const draft = ref('')
const input = useTemplateRef<{ textareaRef?: HTMLTextAreaElement }>('input')
const scroller = useTemplateRef<HTMLElement>('scroller')

const contextLabel = computed(() => context.value.kind === 'thread'
  ? `This conversation: ${context.value.subject || '(No subject)'}`
  : 'Your mail')

// Acting on mail is about your mail as a whole, never the open conversation
const canDo = computed(() => commands.available.value && context.value.kind === 'mail')
const doing = computed(() => mode.value === 'do' && canDo.value)
const ready = computed(() => doing.value || canAsk.value)

const placeholder = computed(() => {
  if (doing.value) return 'Say what to do, like “archive newsletters older than a month”'
  return context.value.kind === 'thread' ? 'Ask about this conversation' : 'Ask about your mail'
})

const suggestions = computed(() => {
  if (doing.value) return ['Archive newsletters older than a month', 'Mark everything from GitHub as read', 'Snooze mail from Ana until tomorrow']
  if (context.value.kind === 'thread') return ['What’s been decided so far?', 'What does the latest message ask of me?', 'List every date and amount']
  return ['Which invoices came in this month?', 'When is my next flight?', 'What did Ana send me last week?']
})

function send(text = draft.value) {
  if (!text.trim() || busy.value || !ready.value) return
  assistant.send(text)
  draft.value = ''
}

function onKeydown(event: KeyboardEvent) {
  // Shift+Enter is a new line; Enter while composing an accented letter belongs to the input method
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  send()
}

function focusInput() {
  input.value?.textareaRef?.focus()
}

// The newest line stays in view as answers come in
watch(() => [turns.value.length, turns.value.at(-1)?.text.length], () => nextTick(() => {
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}))

function showMessage(message: MessageSummary) {
  navigateTo({ path: folderLink(message.folder), query: { m: message.id } })
}

function setMode(next: 'ask' | 'do') {
  mode.value = next
  focusInput()
}

// Like the Today panel it leaves the window live behind it: a click out
// there is work, not a way of closing. Escape and the button close it, and
// focus goes back where it was
let before: HTMLElement | null = null
watch(isOpen, (open) => {
  if (open) before = document.activeElement as HTMLElement | null
})
const content = {
  onInteractOutside: (event: Event) => event.preventDefault(),
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault()
    nextTick(focusInput)
  },
  onCloseAutoFocus: (event: Event) => {
    event.preventDefault()
    if (before?.isConnected) before.focus()
    before = null
  }
}
</script>

<template>
  <USlideover
    v-model:open="isOpen"
    side="right"
    title="Ask AI"
    :description="doing ? 'Say what to do with your mail. Nothing changes until you confirm.' : 'Answers come from your mail. Check anything important.'"
    :modal="false"
    :overlay="false"
    :content="content"
    :ui="{
      content: 'sm:max-w-md',
      body: 'flex min-h-0 flex-col gap-3 p-0 sm:p-0',
      footer: 'flex-col items-stretch gap-2 p-3 sm:p-3'
    }"
  >
    <template #actions>
      <UTooltip text="New chat">
        <UButton
          icon="i-lucide-square-pen"
          color="neutral"
          variant="ghost"
          aria-label="New chat"
          :disabled="!turns.length"
          @click="assistant.newChat(); focusInput()"
        />
      </UTooltip>
    </template>

    <template #body>
      <div class="flex items-center gap-2 px-4 pt-3">
        <span
          class="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-elevated py-1 ps-2.5 text-xs text-toned"
          :class="context.kind === 'thread' ? 'pe-1' : 'pe-2.5'"
        >
          <UIcon
            :name="context.kind === 'thread' ? 'i-lucide-messages-square' : 'i-lucide-inbox'"
            class="size-3.5 shrink-0"
          />
          <span class="truncate">{{ contextLabel }}</span>
          <UButton
            v-if="context.kind === 'thread'"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            class="-my-1 rounded-full"
            aria-label="Stop asking about this conversation"
            @click="assistant.clearContext(); focusInput()"
          />
        </span>
      </div>

      <div
        ref="scroller"
        class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4"
      >
        <div
          v-if="!available"
          class="m-auto flex max-w-xs flex-col items-center gap-2 py-10 text-center"
        >
          <UIcon
            name="i-lucide-sparkles"
            class="size-6 text-(--lb-ai)"
          />
          <p class="text-sm text-muted">
            {{ ai.bridge ? 'Add an AI key in Settings → AI to ask about your mail.' : 'AI runs in the desktop app.' }}
          </p>
        </div>

        <div
          v-else-if="!turns.length"
          class="mt-auto flex flex-col gap-2 pt-6"
        >
          <p class="text-xs font-medium text-muted">
            Try
          </p>
          <UButton
            v-for="(suggestion, index) in suggestions"
            :key="suggestion"
            :label="suggestion"
            color="neutral"
            variant="soft"
            size="sm"
            class="lb-stagger self-start"
            :style="{ '--lb-i': index }"
            :disabled="!ready || busy"
            @click="send(suggestion)"
          />
        </div>

        <!-- Only finished lines are added to the log: an answer being written
          is hidden from screen readers until it is whole -->
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Chat"
          class="flex flex-col gap-4"
          :class="turns.length && 'mt-auto pt-4'"
        >
          <template
            v-for="turn in turns"
            :key="turn.id"
          >
            <div
              v-if="turn.role === 'user'"
              class="lb-in-up max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-elevated px-3 py-2 text-sm text-highlighted wrap-anywhere"
            >
              <span class="sr-only">{{ turn.mode === 'do' ? 'You asked AI to do: ' : 'You asked: ' }}</span>{{ turn.text }}
            </div>

            <div
              v-else
              class="lb-in flex gap-2.5"
            >
              <UIcon
                name="i-lucide-sparkles"
                class="mt-0.5 size-4 shrink-0 text-(--lb-ai)"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <template v-if="turn.state === 'writing'">
                  <p
                    v-if="!turn.text"
                    class="text-sm text-muted"
                  >
                    {{ turn.mode === 'do' ? 'Working it out' : 'Reading' }}<span class="lb-ai-dots" />
                  </p>
                  <p
                    v-else
                    class="lb-ai-caret whitespace-pre-wrap text-sm text-default leading-relaxed wrap-anywhere"
                    aria-hidden="true"
                  >
                    {{ turn.text }}
                  </p>
                </template>
                <p
                  v-else-if="turn.state === 'error'"
                  class="whitespace-pre-wrap text-sm text-error wrap-anywhere"
                >
                  {{ turn.text }}
                </p>
                <template v-else>
                  <span class="sr-only">AI answered:</span>
                  <AssistantAnswer :text="turn.text" />
                  <p
                    v-if="turn.interpreted && turn.found?.length"
                    class="text-xs text-muted"
                  >
                    Searched for: {{ turn.interpreted }}
                  </p>
                  <ul
                    v-if="turn.found?.length"
                    class="-mx-2 flex flex-col"
                    aria-label="Messages found"
                  >
                    <li
                      v-for="message in turn.found"
                      :key="messageKey(message)"
                    >
                      <button
                        type="button"
                        class="lb-focus flex w-full min-w-0 flex-col rounded-md px-2 py-1.5 text-start hover:bg-elevated"
                        @click="showMessage(message)"
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
                    </li>
                  </ul>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        v-if="canDo"
        role="group"
        aria-label="What to do with what you type"
        class="flex gap-1"
      >
        <UButton
          label="Ask"
          icon="i-lucide-message-circle-question"
          color="neutral"
          :variant="!doing ? 'soft' : 'ghost'"
          size="xs"
          :aria-pressed="!doing"
          @click="setMode('ask')"
        />
        <UButton
          label="Do something…"
          icon="i-lucide-wand-sparkles"
          color="neutral"
          :variant="doing ? 'soft' : 'ghost'"
          size="xs"
          :aria-pressed="doing"
          @click="setMode('do')"
        />
      </div>
      <form
        class="flex items-end gap-2"
        @submit.prevent="send()"
      >
        <UTextarea
          ref="input"
          v-model="draft"
          :placeholder="placeholder"
          :aria-label="placeholder"
          :disabled="!ready"
          :rows="1"
          :maxrows="6"
          autoresize
          class="flex-1"
          @keydown="onKeydown"
        />
        <UButton
          v-if="busy"
          icon="i-lucide-square"
          color="neutral"
          variant="soft"
          aria-label="Stop"
          @click="assistant.stop()"
        />
        <UButton
          v-else
          type="submit"
          icon="i-lucide-arrow-up"
          aria-label="Send"
          :disabled="!draft.trim() || !ready"
        />
      </form>
    </template>
  </USlideover>

  <AssistantPlanSheet />
</template>
