<script setup lang="ts">
// The composer on its own, filling the window: a draft popped out of the
// dock, the desktop app's quick-compose window, or a mailto: link.
//   /compose?draft=<id>     carries on with that open draft
//   /compose?mailto=<link>  starts from a mailto: link
//   /compose                a new message
// Once the message is sent, saved or thrown away, the window closes
const route = useRoute()
const router = useRouter()
const { draft, hasDraft, activeId, pending, adopt, compose, composeFromMailto } = useComposer()

useSeoMeta({ title: () => hasDraft.value ? draftTitle(draft.value) : 'New message' })

const started = ref(false)
/** The window couldn't close itself (a browser tab opened by hand) */
const stayed = ref(false)

const one = (value: unknown) => (Array.isArray(value) ? value[0] : value) as string | undefined

onMounted(() => {
  const id = one(route.query.draft)
  const mailto = one(route.query.mailto)
  if (id && adopt(id)) started.value = true
  else if (mailto) composeFromMailto(mailto)
  // After a reload the draft is still this window's (session storage)
  else if (!hasDraft.value || !adopt(activeId.value)) compose()
  started.value = true
})

// The address follows the draft, so a reload carries on instead of starting over
watch(activeId, (id) => {
  if (!started.value || !id || one(route.query.draft) === id) return
  router.replace({ query: { ...route.query, mailto: undefined, draft: id } })
}, { flush: 'post' })

function leave() {
  const app = desktop()
  if (app) app.closeWindow()
  else window.close()
  // Still here: say so, rather than leave an empty window
  setTimeout(() => (stayed.value = true), 400)
}

// Nothing left to write, and nothing still on its way (a send that can be
// undone keeps the window, so Undo has somewhere to put the message back)
watch([started, hasDraft, pending], () => {
  stayed.value = false
  if (started.value && !hasDraft.value && pending.value === 0) leave()
}, { flush: 'post' })
</script>

<template>
  <div class="flex min-w-0 flex-1">
    <MailComposerPanel
      v-if="hasDraft"
      :key="draft.id"
      standalone
      class="lb-in"
    />
    <div
      v-else-if="started"
      class="lb-in grid flex-1 place-items-center p-8"
    >
      <UEmpty
        v-if="pending"
        icon="i-lucide-send"
        title="On its way"
        description="This window closes once it’s done."
        variant="naked"
      />
      <UEmpty
        v-else-if="stayed"
        icon="i-lucide-check"
        title="All done here"
        description="You can close this window."
        variant="naked"
        :actions="[{ label: 'New message', icon: 'i-lucide-pen-line', onClick: () => compose() }]"
      />
    </div>
  </div>
</template>
