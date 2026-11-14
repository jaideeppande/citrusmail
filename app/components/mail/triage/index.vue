<script setup lang="ts">
import type { ShortcutId } from '~/utils/shortcuts'

// The triage card. Everything else fades behind it; each decision slides the
// card off and the next one in
const triage = useTriage()
const mail = useMail()
const cache = useMessageCache()
const { reply } = useComposer()
const { keysOf, kbds } = useShortcutKeys()

const detail = shallowRef<MessageDetail>()
const failed = ref(false)

watch(() => [triage.isOpen.value, triage.current.value] as const, async ([open, message]) => {
  detail.value = undefined
  failed.value = false
  if (!open || !message) return
  const hit = cache.cached(message.folder, message.id)
  if (hit) detail.value = hit.message
  try {
    const entry = await cache.open(message.folder, message.id)
    if (triage.current.value !== message) return
    detail.value = entry.message
    // Seeing it here is reading it, as in the reader
    const row = mail.messages.value.find(item => item.id === message.id && item.folder === message.folder)
    if (row?.unread) mail.setUnread(row, false, entry.marked)
    entry.marked = false
    const next = triage.queue.value[triage.index.value + 1]
    if (next) cache.prefetch([{ folder: next.folder, id: next.id }])
  } catch {
    if (triage.current.value === message) failed.value = true
  }
}, { immediate: true })

function archive() {
  const message = triage.current.value
  if (!message) return
  triage.done.value.archived++
  triage.step(1, 'away')
  mail.move(message, 'archive')
}

function remove() {
  const message = triage.current.value
  if (!message) return
  triage.done.value.deleted++
  triage.step(1, 'away')
  mail.remove(message)
}

function snooze() {
  const message = triage.current.value
  if (!message) return
  triage.done.value.snoozed++
  triage.step(1, 'away')
  // Tomorrow morning: the snooze people mean when they don't say
  const preset = snoozePresets().find(item => item.label === 'Tomorrow morning')!
  mail.snooze([message], preset.date)
}

function answer() {
  if (!detail.value) return
  triage.done.value.replied++
  reply(detail.value)
  triage.step(1)
  // The composer takes over; triage waits where it was left
  triage.close()
}

const actions: { id: ShortcutId, label: string, icon: string, run: () => void }[] = [
  { id: 'mail.archive', label: 'Archive', icon: 'i-lucide-archive', run: archive },
  { id: 'mail.reply', label: 'Reply', icon: 'i-lucide-reply', run: answer },
  { id: 'mail.snooze', label: 'Snooze', icon: 'i-lucide-alarm-clock', run: snooze },
  { id: 'mail.delete', label: 'Delete', icon: 'i-lucide-trash-2', run: remove },
  { id: 'mail.next', label: 'Skip', icon: 'i-lucide-arrow-right', run: () => triage.step(1) }
]

// Its own key handling: while the card is up it is a dialog, and the list's
// shortcuts stand down for dialogs. The keys are the ones set for each action
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!triage.isOpen.value || event.defaultPrevented) return
  const target = event.target as HTMLElement | null
  if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"], [role="menu"]')) return
  if (event.key === 'Escape') return triage.close()
  const key = keyFromEvent(event)
  if (!key) return
  if (keysOf('mail.prev').includes(key)) {
    event.preventDefault()
    return triage.step(-1)
  }
  if (triage.finished.value) return
  const action = actions.find(item => keysOf(item.id).includes(key))
  if (!action) return
  event.preventDefault()
  action.run()
})

const total = computed(() => triage.queue.value.length)
const position = computed(() => Math.min(triage.index.value + 1, total.value))
const summary = computed(() => {
  const { archived, deleted, snoozed, replied } = triage.done.value
  const parts = [[archived, 'archived'], [deleted, 'deleted'], [snoozed, 'snoozed'], [replied, 'answered']].filter(([count]) => count).map(([count, word]) => `${count} ${word}`)
  return parts.length ? parts.join(', ') : 'Nothing changed'
})
</script>

<template>
  <Transition name="lb-fade">
    <div
      v-if="triage.isOpen.value"
      role="dialog"
      aria-modal="true"
      aria-label="Triage"
      class="fixed inset-0 z-40 flex flex-col items-center gap-4 px-6 py-6 bg-(--lb-desk-solid)/92 backdrop-blur-sm"
    >
      <header class="w-full max-w-3xl flex items-center gap-4">
        <span class="text-sm font-medium text-toned tabular-nums whitespace-nowrap">{{ triage.finished.value ? total : position }} of {{ total }}</span>
        <div
          class="flex-1 h-1 rounded-full bg-(--lb-tab-track) overflow-hidden"
          role="progressbar"
          :aria-valuenow="triage.index.value"
          :aria-valuemax="total"
        >
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-(--lb-dur-4) ease-(--lb-ease-out)"
            :style="{ width: `${total ? (triage.index.value / total) * 100 : 0}%` }"
          />
        </div>
        <UButton
          label="Done"
          color="neutral"
          variant="ghost"
          size="sm"
          :ui="{ base: 'gap-2' }"
          @click="triage.close()"
        >
          <template #trailing>
            <UKbd
              value="escape"
              size="sm"
              variant="soft"
            />
          </template>
        </UButton>
      </header>

      <div class="relative flex-1 min-h-0 w-full max-w-3xl">
        <Transition :name="`lb-triage-${triage.way.value}`">
          <article
            v-if="triage.finished.value"
            key="finished"
            class="lb-triage-card items-center justify-center text-center gap-2"
          >
            <UIcon
              name="i-lucide-party-popper"
              class="size-10 text-primary lb-in-scale"
            />
            <h2 class="text-xl font-bold tracking-tight text-highlighted">
              That’s all of them
            </h2>
            <p class="text-sm text-muted">
              {{ summary }}. Anything archived or deleted in the last few seconds can still be undone.
            </p>
            <UButton
              label="Back to the Inbox"
              class="mt-3"
              @click="triage.close()"
            />
          </article>

          <article
            v-else-if="triage.current.value"
            :key="messageKey(triage.current.value)"
            class="lb-triage-card"
          >
            <header class="shrink-0 flex items-start gap-3 px-6 pt-5 pb-4 border-b border-default">
              <SenderAvatar
                :address="triage.current.value.from"
                size="lg"
              />
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-bold tracking-tight text-highlighted text-pretty wrap-anywhere">
                  {{ triage.current.value.subject || '(No subject)' }}
                </h2>
                <p class="text-sm text-muted truncate">
                  {{ personName(triage.current.value.from) }} · {{ fullDate(triage.current.value.date) }}
                </p>
              </div>
            </header>

            <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <MailBody
                v-if="detail"
                :message="detail"
                :remote="detail.remoteShown"
                class="lb-in"
              />
              <UEmpty
                v-else-if="failed"
                icon="i-lucide-mail-x"
                title="Couldn’t open this message"
                description="It may have been moved or deleted from another device."
                variant="naked"
              />
              <div
                v-else
                class="flex flex-col gap-3"
              >
                <USkeleton class="h-4 w-3/4" />
                <USkeleton class="h-4 w-full" />
                <USkeleton class="h-4 w-5/6" />
                <USkeleton class="h-40 w-full rounded-xl mt-2" />
              </div>
            </div>
          </article>
        </Transition>
      </div>

      <footer
        v-if="!triage.finished.value"
        class="flex flex-wrap items-center justify-center gap-1.5"
      >
        <UButton
          v-for="action in actions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          color="neutral"
          variant="soft"
          size="sm"
          class="lb-press bg-default ring ring-default hover:bg-elevated"
          :disabled="action.id === 'mail.reply' && !detail"
          @click="action.run()"
        >
          <template #leading>
            <UKbd
              v-for="key in kbds(action.id)"
              :key="key"
              :value="key"
              size="sm"
              variant="soft"
            />
          </template>
        </UButton>
      </footer>
    </div>
  </Transition>
</template>
