<script setup lang="ts">
// Your other signatures: add, rename, write and delete them. The default one
// lives in Settings → Signature, where it is kept with your account
const open = defineModel<boolean>('open', { required: true })

const { extras, add, update, remove } = useSignatures()
const toast = useToast()

const selected = ref<string>()
const name = ref('')
const html = ref('')
// The editor remounts for each signature, so it starts with that one's words
const version = ref(0)

function select(id?: string) {
  const item = extras.value.find(entry => entry.id === id)
  selected.value = item?.id
  name.value = item?.name ?? ''
  html.value = item?.html ?? ''
  version.value++
}

watch(open, (value) => {
  if (value) select(extras.value[0]?.id)
})

function create() {
  const fresh = add(`Signature ${extras.value.length + 1}`)
  select(fresh.id)
  announce(`${fresh.name} added`)
  nextTick(() => document.querySelector<HTMLInputElement>('#lb-signature-name')?.select())
}

// Saved as it is written: nothing to lose by closing or switching
watch([name, html], () => {
  const current = extras.value.find(item => item.id === selected.value)
  if (current && (current.name !== name.value.trim() || current.html !== html.value)) update(current.id, { name: name.value, html: html.value })
})

function drop() {
  const gone = extras.value.find(item => item.id === selected.value)
  if (!gone) return
  remove(gone.id)
  select(extras.value[0]?.id)
  toast.add({
    title: 'Signature deleted',
    description: gone.name,
    icon: 'i-lucide-trash-2',
    actions: [{ label: 'Undo', color: 'neutral', variant: 'outline', onClick: () => (extras.value = [...extras.value, gone]) }]
  })
  announce(`${gone.name} deleted`)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Signatures"
    description="Choose one in each message from the signature menu. The default one is in Settings → Signature."
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-between' }"
  >
    <template #body>
      <div class="flex min-h-72 gap-4">
        <nav
          aria-label="Your signatures"
          class="flex w-44 shrink-0 flex-col gap-0.5"
        >
          <UButton
            v-for="item in extras"
            :key="item.id"
            :label="item.id === selected ? name || item.name : item.name"
            color="neutral"
            :variant="item.id === selected ? 'soft' : 'ghost'"
            size="sm"
            block
            class="justify-start"
            :aria-current="item.id === selected ? 'true' : undefined"
            @click="select(item.id)"
          />
          <UButton
            label="New signature"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            class="justify-start text-muted"
            @click="create"
          />
        </nav>

        <div
          v-if="selected"
          class="flex min-w-0 flex-1 flex-col gap-3"
        >
          <UFormField
            label="Name"
            name="signature-name"
          >
            <UInput
              id="lb-signature-name"
              v-model="name"
              maxlength="60"
              class="w-full"
            />
          </UFormField>
          <div class="overflow-hidden rounded-lg ring ring-default">
            <UEditor
              :key="version"
              v-slot="{ editor }"
              v-model="html"
              content-type="html"
              placeholder="Ana Lima&#10;Head of Design"
              aria-label="Signature"
              class="flex flex-col"
              :ui="{ content: 'order-2 px-4 py-3 min-h-32', base: 'px-0 sm:px-0 text-sm leading-6 [&_p]:leading-6 *:my-0' }"
            >
              <div class="order-1 border-b border-default bg-elevated/40 px-2 py-1.5">
                <MailComposerToolbar :editor="editor" />
              </div>
            </UEditor>
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-signature"
          title="No other signatures yet"
          description="Add one for replies, a team or a language, and pick it as you write."
          variant="naked"
          class="flex-1"
          :actions="[{ label: 'New signature', icon: 'i-lucide-plus', onClick: create }]"
        />
      </div>
    </template>
    <template #footer>
      <UButton
        v-if="selected"
        label="Delete signature"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        @click="drop"
      />
      <span v-else />
      <UButton
        label="Done"
        @click="open = false"
      />
    </template>
  </UModal>
</template>
