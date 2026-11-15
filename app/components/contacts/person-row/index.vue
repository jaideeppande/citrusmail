<script setup lang="ts">
// One person on the Relationships page: who, a line of numbers, and the
// two things you might want to do about them
const props = defineProps<{
  person: PersonStats
  /** What the line under the name says */
  detail: string
  /** The received/sent split, scaled against the busiest person shown */
  bar?: { max: number }
}>()

const { contactFor } = useRelationships()
const { openCreate } = useContactsPage()
const { books } = useContacts()
const { compose } = useComposer()

const contact = computed(() => contactFor(props.person.address))
const name = computed(() => contact.value?.name || props.person.name || props.person.address)

function write() {
  compose([{ name: name.value, address: props.person.address }])
}

function add() {
  openCreate({ name: props.person.name || '', emails: [props.person.address] })
}
</script>

<template>
  <li class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50">
    <SenderAvatar
      :address="{ name, address: person.address }"
      size="sm"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex min-w-0 items-baseline gap-2">
        <NuxtLink
          v-if="contact"
          :to="{ path: '/contacts', query: { c: contact.id } }"
          class="lb-focus truncate rounded-sm text-sm font-medium text-highlighted underline-offset-2 hover:underline"
        >{{ name }}</NuxtLink>
        <span
          v-else
          class="truncate text-sm font-medium text-highlighted"
        >{{ name }}</span>
        <span
          v-if="name !== person.address"
          class="hidden truncate text-xs text-muted xl:inline"
        >{{ person.address }}</span>
      </div>
      <p class="truncate text-xs text-muted">
        {{ detail }}
      </p>
      <!-- The bar repeats the numbers in the line above: never the only place they are -->
      <div
        v-if="bar"
        class="mt-0.5 flex h-1.5 overflow-hidden rounded-full bg-elevated"
        :style="{ width: `${Math.max(8, person.total / bar.max * 100)}%` }"
        data-contact-bar
        aria-hidden="true"
      >
        <span
          class="h-full bg-(--ui-primary)"
          :style="{ width: `${person.received / person.total * 100}%` }"
        />
        <span
          class="h-full bg-(--ui-color-neutral-400) dark:bg-(--ui-color-neutral-500)"
          :style="{ width: `${person.sent / person.total * 100}%` }"
        />
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="!contact && books.length"
        label="Add to contacts"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Add ${name} to contacts`"
        @click="add"
      />
      <UButton
        icon="i-lucide-square-pen"
        label="Write"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Write to ${name}`"
        @click="write"
      />
    </div>
  </li>
</template>
