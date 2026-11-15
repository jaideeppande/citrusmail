<script setup lang="ts">
import type { PrepItem } from '~/utils/ai-calendar'

// Meeting prep: a short brief on the people in an event, from your recent
// mail with them. In the event's form it starts as a Prepare button; the
// Today panel opens it straight away (`immediate`)
const props = defineProps<{
  event: CalendarEvent
  immediate?: boolean
}>()

const emit = defineEmits<{
  navigate: []
  close: []
}>()

const prep = useAiMeetingPrep(() => props.event)
const expanded = ref(!!props.immediate)
const panel = useTemplateRef('panel')

const now = useNow({ interval: 60_000 })
const written = computed(() => {
  const at = prep.result.value?.at
  if (!at) return ''
  if (now.value.getTime() - at < 60_000) return 'Just now'
  return isoDate(new Date(at)) === isoDate(now.value) ? `At ${formatTime(new Date(at))}` : formatAgo(at, now.value.getTime())
})

async function open() {
  expanded.value = true
  if (!prep.result.value) prep.prepare()
  // The brief is read from its heading, the way a panel opening takes the focus
  await nextTick()
  panel.value?.focus({ preventScroll: true })
}

function close() {
  prep.cancel()
  expanded.value = false
  emit('close')
}

onMounted(() => {
  if (props.immediate) open()
})

function messageLink(item: { folder: string, id: string }) {
  return `${folderLink(item.folder)}?m=${encodeURIComponent(item.id)}`
}

const sections = computed(() => {
  const result = prep.result.value?.prep
  if (!result) return []
  return [
    { id: 'asks', title: 'Asked of you', items: result.asksOfYou, empty: 'Nothing they’re waiting on from you.' },
    { id: 'open', title: 'Open questions', items: result.openQuestions, empty: 'No open questions in the mail.' }
  ] as { id: string, title: string, items: PrepItem[], empty: string }[]
})
</script>

<template>
  <template v-if="prep.on.value && prep.inReach.value">
    <UButton
      v-if="!expanded"
      :label="prep.result.value ? 'Show prep' : 'Prepare'"
      icon="i-lucide-sparkles"
      color="neutral"
      variant="soft"
      size="sm"
      block
      :ui="{ leadingIcon: 'text-(--lb-ai)' }"
      @click="open"
    />

    <section
      v-else
      ref="panel"
      tabindex="-1"
      class="relative flex flex-col gap-2 overflow-hidden rounded-md bg-(--lb-ai-bg) px-3 py-2.5 text-sm outline-none"
      :aria-label="`Meeting prep for ${event.title}`"
      :aria-busy="prep.busy.value"
      @keydown.escape.stop="close"
    >
      <span
        v-if="prep.busy.value"
        class="lb-ai-progress absolute inset-x-0 top-0 h-px"
        aria-hidden="true"
      />
      <header class="flex items-center gap-2">
        <UIcon
          name="i-lucide-sparkles"
          class="size-3.5 text-(--lb-ai)"
          aria-hidden="true"
        />
        <h3 class="text-xs font-semibold text-highlighted">
          Meeting prep
        </h3>
        <span
          v-if="written && !prep.busy.value"
          class="text-xs text-muted"
        >{{ written }}</span>
        <div class="ms-auto -me-1.5 flex items-center">
          <UTooltip text="Prepare again">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Prepare again"
              :loading="prep.busy.value"
              @click="prep.prepare()"
            />
          </UTooltip>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Close meeting prep"
            @click="close"
          />
        </div>
      </header>

      <p
        v-if="prep.busy.value && !prep.result.value"
        class="text-muted"
      >
        Reading your mail with {{ prep.people.value.map(person => person.name).join(', ') || 'them' }}<span class="lb-ai-dots" />
      </p>

      <p
        v-else-if="prep.error.value && !prep.result.value"
        class="text-muted"
      >
        {{ prep.error.value }}
      </p>

      <div
        v-else-if="prep.result.value"
        class="flex max-h-80 flex-col gap-2.5 overflow-y-auto"
      >
        <p class="text-xs text-muted">
          With
          <template
            v-for="(person, index) in prep.result.value.people"
            :key="person.emails[0] ?? person.name"
          >
            <NuxtLink
              v-if="person.contactId"
              :to="{ path: '/contacts', query: { c: person.contactId } }"
              class="lb-focus rounded-xs font-medium text-highlighted underline-offset-2 hover:underline"
              @click="emit('navigate')"
            >{{ person.name }}</NuxtLink>
            <span
              v-else
              class="font-medium text-highlighted"
            >{{ person.name }}</span>{{ index < prep.result.value.people.length - 1 ? ', ' : '' }}
          </template>
        </p>

        <p
          v-if="prep.result.value.prep.context"
          class="text-default"
        >
          {{ prep.result.value.prep.context }}
        </p>

        <div
          v-for="section in sections"
          :key="section.id"
        >
          <h4 class="pb-0.5 text-xs font-semibold text-muted">
            {{ section.title }}
          </h4>
          <p
            v-if="!section.items.length"
            class="text-xs text-muted"
          >
            {{ section.empty }}
          </p>
          <ul
            v-else
            class="flex flex-col gap-0.5"
          >
            <li
              v-for="(item, index) in section.items"
              :key="index"
              class="flex items-start gap-2"
            >
              <span
                class="mt-2 size-1 shrink-0 rounded-full bg-(--lb-ai)"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">
                {{ item.text }}
                <NuxtLink
                  v-if="item.message"
                  :to="messageLink(item.message)"
                  class="lb-focus rounded-xs text-xs text-muted underline underline-offset-2 hover:text-highlighted"
                  @click="emit('navigate')"
                >Open message</NuxtLink>
              </span>
            </li>
          </ul>
        </div>

        <div v-if="prep.result.value.recent.length">
          <h4 class="pb-0.5 text-xs font-semibold text-muted">
            Recent mail
          </h4>
          <ul class="-mx-1.5 flex flex-col">
            <li
              v-for="item in prep.result.value.recent"
              :key="`${item.folder}:${item.id}`"
            >
              <NuxtLink
                :to="messageLink(item)"
                class="lb-focus flex min-w-0 items-baseline gap-2 rounded-md px-1.5 py-0.5 hover:bg-elevated/60"
                @click="emit('navigate')"
              >
                <UIcon
                  :name="item.direction === 'sent' ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-left'"
                  class="size-3 shrink-0 self-center text-muted"
                  aria-hidden="true"
                />
                <span class="sr-only">{{ item.direction === 'sent' ? `You wrote to ${item.who}:` : `${item.who} wrote:` }}</span>
                <span class="min-w-0 flex-1 truncate text-default">{{ item.subject }}</span>
                <span class="shrink-0 text-xs text-muted tabular-nums">{{ listDate(item.date) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <p
          v-if="prep.error.value"
          class="text-xs text-muted"
        >
          {{ prep.error.value }}
        </p>
      </div>
    </section>
  </template>
</template>
