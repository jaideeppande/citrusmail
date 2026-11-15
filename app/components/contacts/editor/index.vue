<script setup lang="ts">
import type { ContactLocalExtras } from '~/composables/useContactsPage'

const props = defineProps<{
  contact: Contact | null
  books: ContactBook[]
}>()

const emit = defineEmits<{
  save: [contact: Contact, extras: ContactLocalExtras]
}>()

const open = defineModel<boolean>('open', { required: true })

const state = ref<Contact>({ id: '', bookId: '', name: '', emails: [''], phones: [] })
const { saving } = useContactsPage()
const { photoOf, timeZoneOf } = useContactExtras()

// The photo and the time zone are kept on this computer, not in the card,
// so they are held here until the contact itself is saved
const photo = ref<string>()
const zone = ref<string>()
const extrasTouched = ref({ photo: false, zone: false })

interface Errors {
  name?: string
  emails: (string | undefined)[]
  phones: (string | undefined)[]
  company?: string
  title?: string
  note?: string
  birthday?: string
  bookId?: string
}
const errors = ref<Errors>({ emails: [], phones: [] })

watch(() => props.contact, (contact) => {
  if (!contact) return
  state.value = { ...contact, emails: [...contact.emails], phones: [...contact.phones] }
  photo.value = photoOf(contact.emails[0])
  zone.value = timeZoneOf(contact.emails[0])
  extrasTouched.value = { photo: false, zone: false }
  errors.value = { emails: [], phones: [] }
}, { immediate: true })

const hasEmail = computed(() => state.value.emails.some(email => email.trim()))

function validate(): boolean {
  const contact = {
    ...state.value,
    emails: state.value.emails.map(email => email.trim()),
    phones: state.value.phones.map(phone => phone.trim())
  }
  // Blank lines are dropped on saving rather than reported
  const kept = (list: string[]) => list.map((value, index) => ({ value, index })).filter(item => item.value)
  const emails = kept(contact.emails)
  const phones = kept(contact.phones)
  const problems = contactProblems({ ...contact, emails: emails.map(item => item.value), phones: phones.map(item => item.value) })

  const next: Errors = { emails: [], phones: [] }
  for (const problem of problems) {
    if (problem.field === 'emails' && problem.index !== undefined) next.emails[emails[problem.index]!.index] = 'Not an email address'
    else if (problem.field === 'phones' && problem.index !== undefined) next.phones[phones[problem.index]!.index] = problem.message
    else if (problem.field !== 'emails' && problem.field !== 'phones') next[problem.field] ??= problem.message
  }
  if (!state.value.bookId && !state.value.id) next.bookId = 'Choose an address book'
  errors.value = next

  // The first problem, in the order the form reads, is where focus goes
  const first = [
    next.name && ['contact-name', next.name],
    ...next.emails.map((message, index) => message && [`contact-email-${index}`, `Email ${index + 1}: ${message}`]),
    ...next.phones.map((message, index) => message && [`contact-phone-${index}`, `Phone ${index + 1}: ${message}`]),
    next.company && ['contact-company', next.company],
    next.title && ['contact-title', next.title],
    next.birthday && ['contact-birthday', next.birthday],
    next.note && ['contact-note', next.note],
    next.bookId && ['contact-book', next.bookId]
  ].find(Boolean) as [string, string] | undefined

  if (first) {
    const count = problems.length + (next.bookId ? 1 : 0)
    announce(count > 1 ? `${count} problems. ${first[1]}` : first[1], true)
    document.getElementById(first[0])?.focus()
    return false
  }
  return true
}

function onSubmit() {
  if (saving.value || !validate()) return
  // The page closes the slideover once the save lands; `saving` holds until then
  emit('save', state.value, {
    photo: extrasTouched.value.photo ? photo.value ?? null : undefined,
    zone: extrasTouched.value.zone ? zone.value ?? null : undefined
  })
}

function setPhoto(value: string | undefined) {
  photo.value = value
  extrasTouched.value = { ...extrasTouched.value, photo: true }
}

function setZone(value: string | undefined) {
  zone.value = value
  extrasTouched.value = { ...extrasTouched.value, zone: true }
}

function clearError(field: Exclude<keyof Errors, 'emails' | 'phones'>) {
  if (errors.value[field]) errors.value = { ...errors.value, [field]: undefined }
}
function clearListError(field: 'emails' | 'phones', index: number) {
  if (errors.value[field][index]) errors.value = { ...errors.value, [field]: errors.value[field].map((message, i) => i === index ? undefined : message) }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="state.id ? 'Edit contact' : 'New contact'"
    :ui="{ body: 'flex flex-col gap-5', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <form
        id="contact-form"
        class="flex flex-col gap-5"
        novalidate
        @submit.prevent="onSubmit"
      >
        <div class="flex items-center gap-4">
          <ContactsPhoto
            :model-value="photo"
            :name="state.name"
            :address="state.emails.find(email => email.trim())"
            size="2xl"
            :disabled="!hasEmail"
            :plain="extrasTouched.photo && !photo"
            disabled-reason="Add an email address first: the photo is kept with it"
            @update:model-value="setPhoto"
          />
          <p class="flex-1 text-xs text-muted">
            Photos and time zones are kept on this computer, not in your address book, and show wherever this person’s address appears.
          </p>
        </div>

        <UFormField
          label="Name"
          name="name"
          required
          :error="errors.name"
        >
          <UInput
            id="contact-name"
            v-model="state.name"
            autofocus
            autocomplete="off"
            class="w-full"
            @update:model-value="clearError('name')"
          />
        </UFormField>

        <ContactsListField
          v-model="state.emails"
          label="Email"
          type="email"
          add-label="Add email"
          id-prefix="contact-email"
          :errors="errors.emails"
          @edit="clearListError('emails', $event)"
        />
        <ContactsListField
          v-model="state.phones"
          label="Phone"
          type="tel"
          add-label="Add phone"
          id-prefix="contact-phone"
          :errors="errors.phones"
          @edit="clearListError('phones', $event)"
        />

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Company"
            name="company"
            :error="errors.company"
          >
            <UInput
              id="contact-company"
              v-model="state.company"
              autocomplete="organization"
              class="w-full"
              @update:model-value="clearError('company')"
            />
          </UFormField>
          <UFormField
            label="Job title"
            name="title"
            :error="errors.title"
          >
            <UInput
              id="contact-title"
              v-model="state.title"
              autocomplete="organization-title"
              class="w-full"
              @update:model-value="clearError('title')"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Birthday"
            name="birthday"
            :error="errors.birthday"
          >
            <UInput
              id="contact-birthday"
              v-model="state.birthday"
              type="date"
              class="w-full"
              @update:model-value="clearError('birthday')"
            />
          </UFormField>
          <UFormField
            label="Time zone"
            name="zone"
            :help="hasEmail ? undefined : 'Needs an email address'"
          >
            <ContactsZonePicker
              id="contact-zone"
              :model-value="zone"
              :disabled="!hasEmail"
              @update:model-value="setZone"
            />
          </UFormField>
        </div>

        <UFormField
          label="Note"
          name="note"
          :error="errors.note"
        >
          <UTextarea
            id="contact-note"
            v-model="state.note"
            autoresize
            :rows="3"
            class="w-full"
            @update:model-value="clearError('note')"
          />
        </UFormField>

        <UFormField
          v-if="books.length > 1"
          label="Address book"
          name="book"
          :help="state.id ? 'A saved contact stays in its address book.' : undefined"
          :error="errors.bookId"
        >
          <USelect
            id="contact-book"
            v-model="state.bookId"
            :items="books.map(book => ({ label: book.name, value: book.id }))"
            :disabled="!!state.id"
            class="w-full"
            @update:model-value="clearError('bookId')"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        type="submit"
        form="contact-form"
        :label="state.id ? 'Save' : 'Add contact'"
        :loading="saving"
      />
    </template>
  </USlideover>
</template>
