<script setup lang="ts">
useSeoMeta({ title: 'Relationships' })

const { account } = useShell()
const { snapshot, result, loading, failed, progress, load } = useRelationships()
const { isSidebarOpen } = useShell()
useContactsCommands()

onMounted(() => load())

const now = useNow({ interval: 60_000 })

const covered = computed(() => {
  const data = snapshot.value
  if (!data) return ''
  const count = data.inbox.length + data.sent.length
  const since = data.since ? ` back to ${new Date(data.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
  return `Based on the last ${count} messages in Inbox${data.noSent ? '' : ' and Sent'}${since}. ${data.partial ? 'Older mail isn’t counted.' : 'That is all of it.'} Worked out on this computer.`
})

const updated = computed(() => snapshot.value ? formatAgo(snapshot.value.at, now.value.getTime()) : '')
const updatedLabel = computed(() => {
  if (!snapshot.value) return ''
  const minutes = Math.floor((now.value.getTime() - snapshot.value.at) / 60_000)
  return minutes < 1 ? 'Updated just now' : minutes < 60 ? `Updated ${minutes} min ago` : `Updated ${updated.value}`
})

const busiest = computed(() => Math.max(1, ...(result.value?.mostInTouch.map(person => person.total) ?? [])))

function messages(count: number) {
  return count === 1 ? '1 message' : `${count} messages`
}

function replyLine(person: PersonStats) {
  const parts = [
    person.theirReplyMs !== undefined ? `they answer in ${formatWait(person.theirReplyMs)}` : '',
    person.yourReplyMs !== undefined ? `you in ${formatWait(person.yourReplyMs)}` : ''
  ].filter(Boolean)
  return parts.length ? ` · usually ${parts.join(', ')}` : ''
}

const at = () => now.value.getTime()

const sections = computed(() => {
  const data = result.value
  if (!data) return []
  return [{
    id: 'most',
    title: 'Most in touch',
    empty: 'Nobody yet: write to someone and they show up here.',
    people: data.mostInTouch,
    bar: true,
    detail: (person: PersonStats) => `${messages(person.total)}: ${person.received} from them, ${person.sent} from you${replyLine(person)}`
  }, {
    id: 'owe',
    title: 'You owe a reply',
    bar: false,
    empty: 'Nobody has been waiting on you for more than two days.',
    people: data.oweReply,
    detail: (person: PersonStats) => `They wrote ${formatAgo(person.lastReceived!, at())}${person.lastSent ? `, you last wrote ${formatAgo(person.lastSent, at())}` : ''}`
  }, {
    id: 'waiting',
    title: 'Waiting on them',
    bar: false,
    empty: 'Nobody has left you waiting for more than two days.',
    people: data.waiting,
    detail: (person: PersonStats) => `You wrote ${formatAgo(person.lastSent!, at())}${person.lastReceived ? `, they last wrote ${formatAgo(person.lastReceived, at())}` : ', no answer yet'}`
  }, {
    id: 'lost',
    title: 'Lost touch',
    bar: false,
    empty: `Nobody you exchanged ${LOST_MIN_MESSAGES} or more messages with has gone quiet for ${LOST_AFTER_DAYS} days.`,
    people: data.lostTouch,
    detail: (person: PersonStats) => `${messages(person.total)}, last ${formatAgo(person.last, at())}`
  }]
})
</script>

<template>
  <div class="relative flex min-w-0 flex-1">
    <ServiceNotConnected
      v-if="!account?.hasContacts"
      class="flex-1"
    />
    <div
      v-else
      class="flex min-w-0 flex-1 flex-col"
    >
      <header class="flex h-12 shrink-0 items-center gap-2 px-3">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="soft"
          size="sm"
          aria-label="Open menu"
          class="shrink-0 lg:hidden"
          @click="isSidebarOpen = true"
        />
        <span
          v-if="snapshot && !loading"
          class="ms-auto text-xs text-muted"
        >{{ updatedLabel }}</span>
        <UButton
          icon="i-lucide-refresh-cw"
          label="Refresh"
          color="neutral"
          variant="ghost"
          size="sm"
          :class="!snapshot || loading ? 'ms-auto' : ''"
          :loading="loading"
          @click="load(true)"
        />
      </header>

      <div class="flex-1 overflow-y-auto">
        <div class="mx-auto flex max-w-3xl flex-col gap-8 px-8 pt-4 pb-12">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
              Relationships
            </h1>
            <p
              v-if="covered"
              class="text-sm text-muted"
            >
              {{ covered }}
            </p>
            <p
              v-else
              class="text-sm text-muted"
            >
              Who you’re in touch with, who is waiting on whom, and who has gone quiet, from your Inbox and Sent.
            </p>
          </div>

          <div
            v-if="loading && !snapshot"
            class="flex flex-col gap-3"
            aria-busy="true"
          >
            <UProgress
              :model-value="progress.done"
              :max="progress.total"
              size="sm"
              class="max-w-64"
              :aria-label="`Reading your mail: page ${progress.done} of ${progress.total}`"
            />
            <p class="text-sm text-muted">
              Reading your mail, page {{ progress.done }} of {{ progress.total }}…
            </p>
          </div>

          <UEmpty
            v-else-if="failed && !snapshot"
            icon="i-lucide-cloud-off"
            title="Couldn’t read your mail"
            description="The mail server didn’t answer."
            :actions="[{ label: 'Try again', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'subtle', onClick: () => load(true) }]"
            variant="naked"
          />

          <template v-else-if="result">
            <section
              v-for="section in sections"
              :key="section.id"
              :aria-labelledby="`relationships-${section.id}`"
            >
              <h2
                :id="`relationships-${section.id}`"
                class="flex items-baseline gap-2 pb-1.5 text-sm font-semibold text-highlighted"
              >
                {{ section.title }}
                <span class="text-xs font-normal text-muted tabular-nums">{{ section.people.length }}</span>
              </h2>
              <p
                v-if="section.id === 'most' && section.people.length"
                class="flex items-center gap-3 pb-2 text-xs text-muted"
              >
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-2 rounded-full bg-(--ui-primary)"
                    aria-hidden="true"
                  />From them</span>
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-2 rounded-full bg-(--ui-color-neutral-400) dark:bg-(--ui-color-neutral-500)"
                    aria-hidden="true"
                  />From you</span>
              </p>
              <p
                v-if="!section.people.length"
                class="py-2 text-sm text-muted"
              >
                {{ section.empty }}
              </p>
              <ul
                v-else
                class="flex flex-col"
              >
                <ContactsPersonRow
                  v-for="person in section.people"
                  :key="person.address"
                  :person="person"
                  :detail="section.detail(person)"
                  :bar="section.bar ? { max: busiest } : undefined"
                />
              </ul>
            </section>
          </template>
        </div>
      </div>
      <ContactsDialogs />
    </div>
  </div>
</template>
