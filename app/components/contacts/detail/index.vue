<script setup lang="ts">
const props = defineProps<{
  contact: Contact
}>()

const { compose } = useComposer()
const { openEdit, confirmRemove, selectedId } = useContactsPage()

const subtitle = computed(() => [props.contact.title, props.contact.company].filter(Boolean).join(' at '))
// Read from its parts rather than through `Date`, which takes a bare date for
// midnight UTC (the day before anywhere west of it) and has no way to hold a
// birthday that gives no year
const birthday = computed(() => formatBirthday(props.contact.birthday))

const address = computed(() => props.contact.emails[0])
const { copy, copied } = useClipboard({ copiedDuring: 1500 })

function write() {
  if (address.value) compose([{ name: props.contact.name, address: address.value }])
}

// The page keeps its selection in the URL (`?c=`), so the address alone is
// enough for another window to open on the same person
function popOut() {
  openPopout(`/contacts?c=${encodeURIComponent(props.contact.id)}`)
}

// A pop-out is already a window of its own
const canPopOut = windowKind() === 'main'
</script>

<template>
  <article class="flex flex-col min-h-0 bg-default">
    <header class="shrink-0 flex items-center gap-1 h-14 px-3 border-b border-default">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        class="lg:hidden"
        @click="selectedId = undefined"
      />
      <ContactsStar :contact="contact" />
      <div class="ms-auto flex items-center gap-1">
        <UTooltip
          v-if="address"
          text="New message"
        >
          <UButton
            icon="i-lucide-mail-plus"
            color="neutral"
            variant="ghost"
            aria-label="New message"
            @click="write"
          />
        </UTooltip>
        <UTooltip
          v-if="address"
          :text="copied ? 'Copied' : 'Copy address'"
        >
          <UButton
            color="neutral"
            variant="ghost"
            aria-label="Copy address"
            @click="copy(address)"
          >
            <UIcon
              :key="String(copied)"
              :name="copied ? 'i-lucide-check' : 'i-lucide-at-sign'"
              class="size-5"
              :class="copied && 'lb-mark-pop text-success'"
            />
          </UButton>
        </UTooltip>
        <UTooltip
          v-if="canPopOut"
          text="Open in new window"
        >
          <UButton
            icon="i-lucide-picture-in-picture-2"
            color="neutral"
            variant="ghost"
            aria-label="Open in new window"
            @click="popOut"
          />
        </UTooltip>
        <USeparator
          orientation="vertical"
          class="h-5 mx-1"
        />
        <UButton
          icon="i-lucide-pencil"
          label="Edit"
          color="neutral"
          variant="ghost"
          @click="openEdit(contact)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Delete contact"
          @click="confirmRemove(contact)"
        />
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="max-w-xl mx-auto px-6 py-10 flex flex-col items-center gap-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <SenderAvatar
            :address="{ name: contact.name, address: contact.emails[0] ?? contact.name }"
            size="3xl"
          />
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-highlighted">
              {{ contact.name }}
            </h1>
            <p
              v-if="subtitle"
              class="text-muted"
            >
              {{ subtitle }}
            </p>
          </div>
          <UButton
            v-if="address"
            icon="i-lucide-mail"
            label="Write"
            class="lb-press"
            @click="write"
          />
        </div>

        <UCard
          class="w-full"
          :ui="{ body: 'p-0 sm:p-0 divide-y divide-default' }"
        >
          <ContactsField
            v-for="email in contact.emails"
            :key="email"
            label="Email"
            :value="email"
            icon="i-lucide-mail"
            action
            @open="compose([{ name: contact.name, address: email }])"
          />
          <ContactsField
            v-for="phone in contact.phones"
            :key="phone"
            label="Phone"
            :value="phone"
            icon="i-lucide-phone"
            :to="`tel:${phone.replace(/\s/g, '')}`"
          />
          <ContactsField
            v-if="birthday"
            label="Birthday"
            :value="birthday"
            icon="i-lucide-cake"
          />
          <ContactsField
            v-if="contact.note"
            label="Note"
            :value="contact.note"
            icon="i-lucide-sticky-note"
          />
        </UCard>

        <ContactsTimeline :contact="contact" />
      </div>
    </div>
  </article>
</template>
