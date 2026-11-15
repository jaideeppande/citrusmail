<script setup lang="ts">
const props = defineProps<{
  contact: Contact
}>()

const { compose } = useComposer()
const { openEdit, confirmRemove, selectedId } = useContactsPage()
const { photoOf, setPhoto, timeZoneOf, setTimeZone } = useContactExtras()

const subtitle = computed(() => [props.contact.title, props.contact.company].filter(Boolean).join(' at '))
// Read from its parts rather than through `Date`, which takes a bare date for
// midnight UTC (the day before anywhere west of it) and has no way to hold a
// birthday that gives no year
const birthday = computed(() => formatBirthday(props.contact.birthday))

const address = computed(() => props.contact.emails[0])
const { copy, copied } = useClipboard({ copiedDuring: 1500 })

// Kept on this computer under each of their addresses, so it follows them into mail and the composer
const photo = computed({
  get: () => photoOf(address.value),
  set: value => setPhoto(props.contact.emails, value)
})
const zone = computed({
  get: () => timeZoneOf(address.value),
  set: value => setTimeZone(props.contact.emails, value)
})

function write() {
  if (address.value) compose([{ name: props.contact.name, address: address.value }])
}

async function copyAddress() {
  if (!address.value) return
  await copy(address.value)
  if (copied.value) announce('Address copied')
}

// The page keeps its selection in the URL (`?c=`), so the address alone is
// enough for another window to open on the same person
function popOut() {
  openPopout(`/contacts?c=${encodeURIComponent(props.contact.id)}`)
}

// A pop-out is already a window of its own
const canPopOut = windowKind() === 'main'

// Picking someone moves the screen reader to them, as a page change would
const heading = useTemplateRef('heading')
onMounted(() => {
  if (document.activeElement?.closest('[data-contact-row]')) return
  heading.value?.focus({ preventScroll: true })
})
</script>

<template>
  <article
    class="flex min-h-0 flex-col bg-default"
    aria-labelledby="contact-name"
  >
    <header class="flex h-12 shrink-0 items-center gap-1 px-3">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Back to the list"
        class="lg:hidden"
        @click="selectedId = undefined"
      />
      <ContactsStar
        :contact="contact"
        size="sm"
      />
      <div class="ms-auto flex items-center gap-0.5">
        <UTooltip
          v-if="address"
          :text="copied ? 'Copied' : 'Copy address'"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Copy address"
            @click="copyAddress"
          >
            <UIcon
              :key="String(copied)"
              :name="copied ? 'i-lucide-check' : 'i-lucide-at-sign'"
              class="size-4"
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
            size="sm"
            aria-label="Open in new window"
            @click="popOut"
          />
        </UTooltip>
        <UButton
          icon="i-lucide-pencil"
          label="Edit"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="openEdit(contact)"
        />
        <UTooltip text="Delete contact">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Delete contact"
            @click="confirmRemove(contact)"
          />
        </UTooltip>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-xl flex-col gap-8 px-8 pt-6 pb-12">
        <div class="flex items-center gap-5">
          <ContactsPhoto
            v-model="photo"
            :name="contact.name"
            :address="address"
            size="3xl"
            :disabled="!address"
            disabled-reason="Add an email address to give them a photo"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1
              id="contact-name"
              ref="heading"
              tabindex="-1"
              class="text-2xl font-semibold tracking-tight break-words text-highlighted outline-none"
            >
              {{ contact.name }}
            </h1>
            <p
              v-if="subtitle"
              class="text-sm text-muted"
            >
              {{ subtitle }}
            </p>
            <div
              v-if="address"
              class="mt-2.5"
            >
              <UButton
                icon="i-lucide-square-pen"
                label="Write"
                size="sm"
                class="lb-press"
                @click="write"
              />
            </div>
          </div>
        </div>

        <dl class="flex flex-col">
          <ContactsField
            v-for="email in contact.emails"
            :key="email"
            label="Email"
            :value="email"
            action
            :action-label="`Write to ${email}`"
            @open="compose([{ name: contact.name, address: email }])"
          />
          <ContactsField
            v-for="phone in contact.phones"
            :key="phone"
            label="Phone"
            :value="phone"
            :to="`tel:${phone.replace(/\s/g, '')}`"
          />
          <ContactsField
            v-if="birthday"
            label="Birthday"
            :value="birthday"
          />
          <div
            v-if="address"
            class="grid grid-cols-[7rem_1fr] items-start gap-3 py-1.5"
          >
            <dt class="pt-1.5 text-sm text-muted">
              <label for="contact-detail-zone">Time zone</label>
            </dt>
            <dd class="flex min-w-0 flex-col gap-1">
              <ContactsZonePicker
                id="contact-detail-zone"
                v-model="zone"
              />
              <ContactsLocalTime
                v-if="zone"
                :zone="zone"
              />
            </dd>
          </div>
          <div class="grid grid-cols-[7rem_1fr] items-start gap-3 py-1.5">
            <dt class="pt-0.5 text-sm text-muted">
              Groups
            </dt>
            <dd class="min-w-0">
              <ContactsGroupChips :contact="contact" />
            </dd>
          </div>
          <ContactsField
            v-if="contact.note"
            label="Note"
            :value="contact.note"
          />
        </dl>

        <ContactsTimeline :contact="contact" />
      </div>
    </div>
  </article>
</template>
