<script setup lang="ts">
// Every file on the messages loaded in the open folder, on one page. The
// list only knows which messages have files, so each one is read (without
// marking it read) a few at a time, and its files take their places as they come
const { isOpen } = useAttachmentGallery()
const { messages, folder, selected, thread, select, cursor, status, load } = useMail()
const cache = useMessageCache()

/** Messages read at once: enough to fill the page quickly, few enough to leave the mail server room */
const AT_ONCE = 3

const holders = computed(() => messages.value.filter(message => message.hasAttachments))

// The conversation open in the reader, when it has files of its own
const conversation = computed(() => selected.value ? new Set(thread(selected.value).filter(message => message.hasAttachments).map(messageKey)) : new Set<string>())
const scope = ref<'folder' | 'conversation'>('folder')
watch([isOpen, () => conversation.value.size], ([open, size]) => {
  if (!open || !size) scope.value = 'folder'
})

const files = shallowRef(new Map<string, Attachment[] | 'failed'>())
let running = 0
let generation = 0

function pump() {
  if (!isOpen.value) return
  const current = generation
  while (running < AT_ONCE) {
    const next = holders.value.find(message => !files.value.has(messageKey(message)) && !pending.has(messageKey(message)))
    if (!next) return
    const key = messageKey(next)
    pending.add(key)
    running++
    cache.peek(next.folder, next.id)
      .then(entry => entry.message.attachments)
      .catch(() => 'failed' as const)
      .then((found) => {
        pending.delete(key)
        running--
        if (current !== generation) return
        files.value = new Map(files.value).set(key, found)
        pump()
      })
  }
}
const pending = new Set<string>()

watch([isOpen, holders], () => pump(), { flush: 'post' })
// Another folder is another set of messages
watch(() => folder.value?.path, () => {
  generation++
  running = 0
  pending.clear()
  files.value = new Map()
  pump()
})

const inScope = computed(() => scope.value === 'conversation' ? holders.value.filter(message => conversation.value.has(messageKey(message))) : holders.value)

const items = computed<AttachmentItem[]>(() => inScope.value.flatMap((message) => {
  const found = files.value.get(messageKey(message))
  return Array.isArray(found) ? found.map(file => ({ message, file, url: attachmentUrl(message, file.index) })) : []
}))

/** Messages still being read: each holds a place with a skeleton tile */
const waiting = computed(() => inScope.value.filter(message => !files.value.has(messageKey(message))).length)
const failed = computed(() => inScope.value.filter(message => files.value.get(messageKey(message)) === 'failed').length)

const looking = ref<number>()
watch(isOpen, open => !open && (looking.value = undefined))

function openMessage(item: AttachmentItem) {
  looking.value = undefined
  isOpen.value = false
  select(item.message)
}

function retry() {
  files.value = new Map([...files.value].filter(([, found]) => found !== 'failed'))
  pump()
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Attachments"
    :description="`Files on the messages loaded in ${folder?.name ?? 'this folder'}`"
    :ui="{ content: 'sm:max-w-5xl', body: 'p-4 sm:p-5' }"
  >
    <template #body>
      <div class="flex flex-col gap-4 min-h-72">
        <div class="flex flex-wrap items-center gap-2">
          <div
            v-if="conversation.size"
            class="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-elevated"
          >
            <UButton
              label="This folder"
              color="neutral"
              :variant="scope === 'folder' ? 'solid' : 'ghost'"
              size="xs"
              class="justify-center lb-press"
              :aria-pressed="scope === 'folder'"
              @click="scope = 'folder'"
            />
            <UButton
              label="This conversation"
              color="neutral"
              :variant="scope === 'conversation' ? 'solid' : 'ghost'"
              size="xs"
              class="justify-center lb-press"
              :aria-pressed="scope === 'conversation'"
              @click="scope = 'conversation'"
            />
          </div>
          <p
            class="ms-auto text-xs text-muted tabular-nums"
            aria-live="polite"
          >
            {{ items.length === 1 ? '1 file' : `${items.length} files` }}<span v-if="waiting"> · reading {{ waiting }} more {{ waiting === 1 ? 'message' : 'messages' }}<span class="lb-ai-dots" /></span>
          </p>
        </div>

        <UEmpty
          v-if="!items.length && !waiting"
          icon="i-lucide-paperclip"
          :title="failed ? 'Couldn’t read the attachments' : 'No attachments here'"
          :description="failed ? 'The mail server didn’t answer.' : 'None of the messages loaded in this folder has a file attached.'"
          :actions="failed ? [{ label: 'Try again', icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'subtle', onClick: retry }] : []"
          variant="naked"
          class="flex-1"
        />

        <ul
          v-else
          class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3"
        >
          <li
            v-for="(item, index) in items"
            :key="item.url"
            class="lb-stagger min-w-0"
            :style="{ '--lb-i': index % 12 }"
          >
            <button
              type="button"
              class="group w-full flex flex-col rounded-lg ring ring-default bg-default overflow-hidden text-start lb-press lb-focus hover:ring-accented hover:shadow-sm"
              :aria-label="`Look at ${item.file.filename}`"
              @click="looking = index"
            >
              <span class="relative flex items-center justify-center aspect-4/3 bg-elevated/60 overflow-hidden">
                <img
                  v-if="previewKind(item.file) === 'image'"
                  :src="item.url"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="size-full object-cover transition-transform duration-(--lb-dur-3) ease-(--lb-ease-out) group-hover:scale-[1.03]"
                >
                <UIcon
                  v-else
                  :name="attachmentIcon(item.file.contentType)"
                  class="size-9 text-dimmed"
                />
              </span>
              <span class="flex flex-col gap-0.5 px-2.5 py-2 min-w-0">
                <span class="truncate text-sm font-medium text-highlighted">{{ item.file.filename }}</span>
                <span class="truncate text-xs text-muted">{{ formatSize(item.file.size) }} · {{ personName(item.message.from) }}</span>
              </span>
            </button>
          </li>
          <li
            v-for="n in Math.min(waiting, 8)"
            :key="`waiting-${n}`"
            class="flex flex-col gap-2"
            aria-hidden="true"
          >
            <USkeleton class="aspect-4/3 w-full rounded-lg" />
            <USkeleton class="h-3.5 w-3/4" />
            <USkeleton class="h-3 w-1/2" />
          </li>
        </ul>

        <div
          v-if="scope === 'folder' && (cursor || failed)"
          class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
        >
          <template v-if="cursor">
            <span>Older messages in this folder aren’t loaded yet.</span>
            <UButton
              label="Load more"
              color="neutral"
              variant="link"
              size="xs"
              class="p-0 text-xs"
              :loading="status === 'more'"
              @click="load(false)"
            />
          </template>
          <template v-if="failed && items.length">
            <span>{{ failed === 1 ? '1 message' : `${failed} messages` }} couldn’t be read.</span>
            <UButton
              label="Try again"
              color="neutral"
              variant="link"
              size="xs"
              class="p-0 text-xs"
              @click="retry"
            />
          </template>
        </div>
      </div>

      <MailQuickLook
        v-model:index="looking"
        :items="items"
        show-message
        @message="openMessage"
      />
    </template>
  </UModal>
</template>
