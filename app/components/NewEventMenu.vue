<script setup lang="ts">
// Floating, it is the phone toolbar's button down in the corner, opening
// upwards from there
const props = defineProps<{
  floating?: boolean
}>()

const { createAtAnchor, createFromQuick } = useEventDraft()
const { view, pathFor } = useCalendar()
const { addEvent } = useCalendarEvents()
const { revealEvent } = useEventEditor()
const aiQuick = useAiQuickEvent()

const open = ref(false)
const text = ref('')
const loading = ref(false)

// A ghost's form takes the focus as it opens, and the focus this menu hands
// back to its button as it closes would take it straight out again: a form
// losing the focus is dismissed, and dismissing a draft's form saves it
let handedOff = false

const content = computed(() => ({
  side: props.floating ? 'top' : 'bottom',
  align: props.floating ? 'end' : 'start',
  alignOffset: props.floating ? 0 : -14,
  onCloseAutoFocus: (event: Event) => {
    if (handedOff) {
      event.preventDefault()
      handedOff = false
    }
  }
}) as const)

function handOff(create: () => Promise<void>) {
  handedOff = true
  open.value = false

  return create()
}

// With AI on, the phrase is read for a preview first and nothing is drawn
// until Create or Edit. The phrase it was read from, so a second Enter on
// the same words creates what the preview says
const readText = ref('')

watch(open, (value) => {
  if (!value) {
    aiQuick.reset()
    readText.value = ''
  }
})

async function onAiSubmit(phrase: string) {
  if (aiQuick.plan.value && readText.value === phrase && aiQuick.state.value !== 'reading') {
    await onCreate()
    return
  }

  readText.value = phrase
  await aiQuick.read(phrase)
}

// Saved as it reads, then shown on its day with its form open, the way an
// event clicked on the grid opens. Handed off like a draft, so the focus goes
// to that form rather than back to the button
async function onCreate() {
  aiQuick.cancel()
  const event = aiQuick.toEvent()
  if (!event) return

  addEvent(event)
  announce(`${event.title} added, ${formatSpokenDate(new Date(event.start))}${event.allDay ? '' : ` at ${formatTime(new Date(event.start))}`}`)
  text.value = ''
  readText.value = ''
  aiQuick.reset()
  await handOff(async () => {
    await navigateTo(pathFor(toCalendarDate(new Date(event.start)), view.value === 'year' ? 'month' : view.value))
    revealEvent(event.id)
  })
}

async function onEdit() {
  aiQuick.cancel()
  const plan = aiQuick.plan.value
  if (!plan) return

  const phrase = readText.value
  text.value = ''
  readText.value = ''
  aiQuick.reset()
  await handOff(() => createFromQuick(plan, phrase))
}

// The preview goes, and the focus goes back to the words it came from
const quickForm = useTemplateRef('quickForm')
function onDismiss() {
  aiQuick.reset()
  readText.value = ''
  quickForm.value?.querySelector('input')?.focus()
}

// The model reads the phrase in the browser, and is a download the first time
// it does: the input holds on with a spinner until it has, and only then
// steps aside for the ghost
async function onSubmit() {
  const phrase = text.value.trim()
  if (!phrase || loading.value) {
    return
  }

  if (aiQuick.on.value) {
    return onAiSubmit(phrase)
  }

  loading.value = true

  try {
    const quick = await parseQuickEvent(phrase)

    text.value = ''

    await handOff(() => createFromQuick(quick, phrase))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="content"
    :ui="{ content: 'p-2 w-72 max-w-[calc(100vw-1rem)]' }"
  >
    <UTooltip text="New event">
      <UButton
        icon="i-lucide-plus"
        size="sm"
        aria-label="New event"
      />
    </UTooltip>

    <template #content>
      <UButton
        icon="i-lucide-calendar-plus"
        label="New event"
        color="neutral"
        variant="ghost"
        block
        class="justify-start"
        @click="handOff(createAtAnchor)"
      >
        <template #trailing>
          <UKbd
            value="n"
            variant="soft"
            class="ms-auto"
          />
        </template>
      </UButton>

      <USeparator class="my-2" />

      <form
        ref="quickForm"
        @submit.prevent="onSubmit"
      >
        <UFormField
          label="Create quick event"
          class="px-1 pb-1"
        >
          <UInput
            v-model="text"
            :placeholder="aiQuick.on.value ? 'Lunch with Ana Thursday at 1' : 'Movie at 7pm on Friday'"
            :loading="loading || aiQuick.state.value === 'reading'"
            :maxlength="aiQuick.on.value ? 300 : 100"
            autofocus
            class="w-full"
          />
          <template
            v-if="aiQuick.on.value && !aiQuick.plan.value"
            #help
          >
            <span class="flex items-center gap-1 text-xs text-muted">
              <UIcon
                name="i-lucide-sparkles"
                class="size-3 text-(--lb-ai)"
                aria-hidden="true"
              />
              Press Enter to read it with AI
            </span>
          </template>
        </UFormField>
      </form>

      <Transition name="lb-fade">
        <CalendarAiQuickPreview
          v-if="aiQuick.plan.value"
          :preview="aiQuick.preview.value"
          :state="aiQuick.state.value"
          :note="aiQuick.note.value"
          :reminder="aiQuick.plan.value.reminder"
          class="mx-1 mb-1"
          @create="onCreate"
          @edit="onEdit"
          @dismiss="onDismiss"
        />
      </Transition>
    </template>
  </UPopover>
</template>
