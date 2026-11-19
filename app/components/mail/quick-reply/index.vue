<script setup lang="ts">
// A reply written right under the message: one line that opens into a small
// editor. It goes out the same way as a message from the composer, with your
// signature, the original underneath, the checks and the moment to undo
const props = defineProps<{
  message: MessageDetail
}>()

const { draft, reply, replyDraft, deliver } = useComposer()
const { account } = useShell()

const text = ref('')
const expanded = ref(false)
const all = ref(false)
const busy = ref(false)
const root = useTemplateRef('root')
const field = useTemplateRef('field')

const sender = computed(() => props.message.replyTo[0] ?? props.message.from)
/** "Ana" from "Ana Lima"; the address when there is no name */
const firstName = computed(() => sender.value.name?.trim().split(/\s+/)[0] || sender.value.address)

// Everyone else the message went to, who a reply to all would reach
const others = computed(() => {
  const skip = new Set([account.value?.email.toLowerCase(), sender.value.address.toLowerCase()])
  return [...props.message.to, ...props.message.cc].filter(address => !skip.has(address.address.toLowerCase()))
})
const toAll = computed(() => all.value && others.value.length > 0)
const goesTo = computed(() => (toAll.value ? [sender.value, ...others.value] : [sender.value]).map(personName).join(', '))

// What was typed belongs to the message it was typed under
watch(() => [props.message.folder, props.message.id], () => {
  text.value = ''
  expanded.value = false
  all.value = false
})

function focus() {
  expanded.value = true
  nextTick(() => field.value?.focus())
}

function collapse() {
  expanded.value = false
  field.value?.blur()
}

// Leaving it empty folds it back to one line
function onFocusOut(event: FocusEvent) {
  if (text.value.trim() || busy.value) return
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) return
  expanded.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    send()
  } else if (event.key === 'Escape' && !text.value.trim()) {
    event.preventDefault()
    collapse()
  }
}

async function send() {
  if (!text.value.trim() || busy.value) return
  busy.value = true
  const outgoing = replyDraft(props.message, toAll.value)
  outgoing.html = textToHtml(text.value)
  const sent = await deliver(outgoing)
  busy.value = false
  if (!sent) return
  text.value = ''
  collapse()
}

/** Carries on in the full composer, with what is written so far */
function openInComposer() {
  reply(props.message, toAll.value)
  if (text.value.trim()) draft.value.html = textToHtml(text.value)
  text.value = ''
  expanded.value = false
}

defineAppShortcuts({
  'mail.quickReply': focus
})

defineExpose({ focus })
</script>

<template>
  <div
    ref="root"
    class="lb-quick-reply"
    :data-open="expanded"
    @focusout="onFocusOut"
  >
    <div class="flex items-start gap-2 ps-3 pe-1.5">
      <UIcon
        name="i-lucide-reply"
        class="mt-3 size-4 shrink-0 transition-colors duration-(--lb-dur-2)"
        :class="expanded ? 'text-primary' : 'text-dimmed'"
      />
      <textarea
        ref="field"
        v-model="text"
        rows="1"
        class="lb-quick-reply-field py-2.5 text-[15px] leading-normal text-default placeholder:text-dimmed"
        :data-open="expanded"
        :placeholder="`Reply to ${firstName}…`"
        :aria-label="`Reply to ${firstName}`"
        :readonly="busy"
        @focus="expanded = true"
        @keydown="onKey"
      />
    </div>

    <Transition name="lb-collapse">
      <div v-if="expanded">
        <div class="flex items-center gap-1 px-1.5 pb-1.5">
          <UTooltip
            v-if="others.length"
            :text="all ? 'Replying to everyone' : 'Reply to everyone on the message'"
          >
            <UButton
              label="Reply all"
              icon="i-lucide-reply-all"
              color="neutral"
              :variant="all ? 'soft' : 'ghost'"
              size="sm"
              :aria-pressed="all"
              :class="all && 'text-primary'"
              @click="all = !all"
            />
          </UTooltip>
          <UTooltip text="Open in composer">
            <UButton
              icon="i-lucide-maximize-2"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Open in composer"
              @click="openInComposer"
            />
          </UTooltip>
          <p class="ms-1 min-w-0 flex-1 truncate text-xs text-muted">
            To {{ goesTo }}
          </p>
          <UTooltip
            text="Send"
            :kbds="['meta', 'enter']"
          >
            <UButton
              label="Send"
              trailing-icon="i-lucide-send-horizontal"
              size="sm"
              class="lb-press px-3"
              :loading="busy"
              :disabled="!text.trim()"
              @click="send"
            />
          </UTooltip>
        </div>
      </div>
    </Transition>
  </div>
</template>
